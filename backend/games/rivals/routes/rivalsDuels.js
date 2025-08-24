// backend/games/rivals/routes/rivalsDuels.js
const express = require('express');
const { body, query, param } = require('express-validator');
const db = require('../../../database/database');
const { authenticateToken, handleValidationErrors, checkFeatureFlag } = require('../../../middleware/auth');
const GAME_DATA = require('../data/rivalsGameData');
const { sendInboxRefresh } = require('../../../core/services/notificationService');

const router = express.Router();
const RIVALS_GAME_ID = 'rivals';

const decrementPlayerCount = async (client, duelId) => {
    try {
        const { rows: [duel] } = await client.query('SELECT assigned_server_id FROM duels WHERE id = $1', [duelId]);
        if (duel && duel.assigned_server_id) {
            await client.query('UPDATE game_servers SET player_count = GREATEST(0, player_count - 2) WHERE server_id = $1', [duel.assigned_server_id]);
        }
    } catch (err) {
        console.error(`[PlayerCount] Failed to decrement player count for duel ${duelId}:`, err);
    }
};

router.get('/unseen-results', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const sql = `
            SELECT 
                d.id, d.wager, d.winner_id, d.challenger_id, d.opponent_id, d.result_posted_at,
                winner_profile.linked_game_username as winner_username,
                loser_profile.linked_game_username as loser_username
            FROM duels d
            JOIN user_game_profiles winner_profile ON d.winner_id = winner_profile.user_id AND winner_profile.game_id = $2
            JOIN user_game_profiles loser_profile ON (CASE WHEN d.winner_id = d.challenger_id THEN d.opponent_id ELSE d.challenger_id END) = loser_profile.user_id AND loser_profile.game_id = $2
            WHERE 
                d.game_id = $2
                AND d.status = 'completed_unseen' 
                AND ((d.challenger_id = $1 AND d.challenger_seen_result = FALSE) OR (d.opponent_id = $1 AND d.opponent_seen_result = FALSE))
        `;
        const { rows: results } = await db.query(sql, [userId, RIVALS_GAME_ID]);
        res.status(200).json(results);
    } catch (err) {
        console.error("Get Unseen Rivals Results Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

router.post('/:id/confirm-result', authenticateToken, param('id').isInt(), handleValidationErrors, async (req, res) => {
    const duelId = req.params.id;
    const userId = req.user.userId;
    const client = await db.getPool().connect();
    try {
        await client.query('BEGIN');
        
        const { rows: [duel] } = await client.query("SELECT * FROM duels WHERE id = $1 AND game_id = $2 FOR UPDATE", [duelId, RIVALS_GAME_ID]);
        
        if (!duel) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Rivals duel not found.' }); }
        if (duel.status !== 'completed_unseen') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Duel result has already been processed.' }); }

        const columnToUpdate = duel.challenger_id.toString() === userId ? 'challenger_seen_result' : 'opponent_seen_result';
        const { rows: [updatedDuel] } = await client.query(`UPDATE duels SET ${columnToUpdate} = TRUE WHERE id = $1 RETURNING *`, [duelId]);

        if (updatedDuel.challenger_seen_result && updatedDuel.opponent_seen_result) {
            const loserId = (updatedDuel.winner_id.toString() === updatedDuel.challenger_id.toString()) ? updatedDuel.opponent_id : updatedDuel.challenger_id;
            
            await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [updatedDuel.pot, updatedDuel.winner_id]);
            await client.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [updatedDuel.winner_id, RIVALS_GAME_ID]);
            await client.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [loserId, RIVALS_GAME_ID]);
            await client.query("UPDATE duels SET status = 'completed' WHERE id = $1", [duelId]);
        }
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Result confirmed.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Confirm Rivals Result Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        client.release();
    }
});

router.post('/:id/dispute', authenticateToken, param('id').isInt(), body('reason').trim().notEmpty(), body('has_video_evidence').isBoolean(), handleValidationErrors, async (req, res) => {
    const duelId = req.params.id;
    const reporterId = req.user.userId;
    const { reason, has_video_evidence } = req.body;
    const client = await db.getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows: [duel] } = await client.query("SELECT * FROM duels WHERE id = $1 AND game_id = $2 AND status = 'completed_unseen' FOR UPDATE", [duelId, RIVALS_GAME_ID]);
        if (!duel) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Duel not found or cannot be disputed.' }); }
        
        const reportedId = (duel.challenger_id.toString() === reporterId) ? duel.opponent_id : duel.challenger_id;
        await client.query('INSERT INTO disputes (duel_id, reporter_id, reported_id, reason, has_video_evidence) VALUES ($1, $2, $3, $4, $5)', [duelId, reporterId, reportedId, reason, has_video_evidence]);
        
        await client.query("UPDATE duels SET status = 'under_review' WHERE id = $1", [duelId]);
        console.log(`Dispute filed for duel ${duelId}. Duel is now under review.`);
        
        await client.query('COMMIT');
        sendInboxRefresh(reportedId);
        res.status(201).json({ message: 'Dispute filed successfully. An admin will review it shortly.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Dispute Filing Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        client.release();
    }
});

router.get('/find-player', authenticateToken, query('roblox_username').trim().notEmpty(), handleValidationErrors, async (req, res) => {
    try {
        const { roblox_username } = req.query;
        const sql = `
            SELECT 
                ugp.user_id, 
                ugp.linked_game_username, 
                ugp.avatar_url 
            FROM user_game_profiles ugp
            WHERE ugp.game_id = $1 
              AND ugp.linked_game_username ILIKE $2 
              AND ugp.user_id != $3
        `;
        const { rows: [player] } = await db.query(sql, [RIVALS_GAME_ID, roblox_username, req.user.userId]);
        
        if (!player) {
            return res.status(404).json({ message: 'Player not found or you searched for yourself.' });
        }
        res.status(200).json(player);
    } catch(err) {
        console.error("Find Rivals Player Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

router.post('/challenge', 
    authenticateToken,
    checkFeatureFlag('dueling_rivals_direct'), // [MODIFIED] Added feature flag middleware
    body('opponent_id').isUUID(), 
    body('wager').isInt({ gt: 0 }),
    body('rules.map').trim().escape().notEmpty(),
    body('rules.banned_weapons').isArray(), 
    body('rules.region').isIn(GAME_DATA.regions.map(r => r.id)),
    handleValidationErrors,
    async (req, res) => {
        const challenger_id = req.user.userId;
        const { opponent_id, wager, rules } = req.body;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            
            const { rows: [existingDuel] } = await client.query("SELECT id FROM duels WHERE challenger_id = $1 AND opponent_id = $2 AND status = 'pending'", [challenger_id, opponent_id]);
            if (existingDuel) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'You already have a pending challenge sent to this player.' });
            }

            const { rows: [challenger] } = await client.query("SELECT u.gems, ugp.linked_game_username FROM users u JOIN user_game_profiles ugp ON u.id = ugp.user_id WHERE u.id = $1 AND ugp.game_id = $2 FOR UPDATE", [challenger_id, RIVALS_GAME_ID]);
            if (parseInt(challenger.gems) < wager) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'You do not have enough gems for this wager.' });
            }

            await client.query(
                'INSERT INTO duels (game_id, challenger_id, opponent_id, wager, game_specific_rules) VALUES ($1, $2, $3, $4, $5)', 
                [RIVALS_GAME_ID, challenger_id, opponent_id, wager, JSON.stringify(rules)]
            );
            
            await client.query('COMMIT');
            sendInboxRefresh(opponent_id);
            res.status(201).json({ message: 'Challenge sent!' });
        } catch(err) {
            await client.query('ROLLBACK');
            console.error("Rivals Challenge Error:", err.message);
            res.status(500).json({ message: 'An internal server error occurred.' });
        } finally {
            client.release();
        }
    }
);

router.post('/:id/respond', authenticateToken, param('id').isInt(), body('response').isIn(['accept', 'decline']), handleValidationErrors, async (req, res) => {
    const duelId = req.params.id;
    const { response } = req.body;
    const opponentId = req.user.userId;
    const client = await db.getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows: [duel] } = await client.query("SELECT * FROM duels WHERE id = $1 AND opponent_id = $2 AND status = 'pending' AND game_id = $3 FOR UPDATE", [duelId, opponentId, RIVALS_GAME_ID]);
        if (!duel) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Duel not found or you are not the opponent.' }); }

        if (response === 'decline') {
            await client.query('UPDATE duels SET status = $1 WHERE id = $2', ['declined', duelId]);
            await client.query('COMMIT');
            sendInboxRefresh(duel.challenger_id);
            return res.status(200).json({ message: 'Duel declined.' });
        } 
        
        const { rows: [opponent] } = await client.query('SELECT gems FROM users WHERE id = $1 FOR UPDATE', [opponentId]);
        const { rows: [challenger] } = await client.query('SELECT gems FROM users WHERE id = $1 FOR UPDATE', [duel.challenger_id]);

        if (parseInt(opponent.gems) < parseInt(duel.wager)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'You do not have enough gems.' }); }
        if (parseInt(challenger.gems) < parseInt(duel.wager)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'The challenger no longer has enough gems.' }); }

        await client.query('UPDATE users SET gems = gems - $1 WHERE id = $2', [duel.wager, opponentId]);
        await client.query('UPDATE users SET gems = gems - $1 WHERE id = $2', [duel.wager, duel.challenger_id]);
        
        const totalPot = parseInt(duel.wager) * 2;
        const TAX_RATE_DIRECT = parseFloat(process.env.TAX_RATE_DIRECT || '0.01');
        const taxCollected = Math.ceil(totalPot * TAX_RATE_DIRECT);
        const finalPot = totalPot - taxCollected;
        
        await client.query('UPDATE duels SET status = $1, accepted_at = NOW(), pot = $2, tax_collected = $3 WHERE id = $4', ['accepted', finalPot, taxCollected, duelId]);
        
        await client.query('COMMIT');
        sendInboxRefresh(duel.challenger_id);
        res.status(200).json({ message: 'Duel accepted! You can now start the match from your inbox.' });
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("Respond to Rivals Duel Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        client.release();
    }
});


router.post('/:id/start', authenticateToken, param('id').isInt(), handleValidationErrors, async (req, res) => {
    const duelId = req.params.id;
    const userId = req.user.userId;
    const client = await db.getPool().connect();
    
    try {
        await client.query('BEGIN');
        const { rows: [duel] } = await client.query('SELECT * FROM duels WHERE id = $1 AND (challenger_id = $2 OR opponent_id = $2) AND game_id = $3 FOR UPDATE', [duelId, userId, RIVALS_GAME_ID]);
        if (!duel) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Duel not found or you are not a participant.' }); }
        if (duel.status !== 'accepted') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'This duel cannot be started.' }); }

        const region = duel.game_specific_rules.region;
        const { rows: [server] } = await client.query(`SELECT server_id, join_link FROM game_servers WHERE region = $1 AND game_id = $2 AND player_count < 40 AND last_heartbeat >= NOW() - INTERVAL '60 seconds' ORDER BY player_count ASC LIMIT 1 FOR UPDATE`, [region, RIVALS_GAME_ID]);
        if (!server) { await client.query('ROLLBACK'); return res.status(400).json({ message: `All servers for the ${region} region are currently full.` }); }

        await client.query('UPDATE game_servers SET player_count = player_count + 2 WHERE server_id = $1', [server.server_id]);
        
        const expirationOffset = Math.floor(Math.random() * 61) - 30;
        await client.query(`UPDATE duels SET status = 'started', started_at = NOW(), server_invite_link = $1, assigned_server_id = $2, expiration_offset_seconds = $3 WHERE id = $4`, [server.join_link, server.server_id, expirationOffset, duelId]);

        const { rows: [p1] } = await client.query('SELECT linked_game_username FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, RIVALS_GAME_ID]);
        const { rows: [p2] } = await client.query('SELECT linked_game_username FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, RIVALS_GAME_ID]);
        const mapInfo = GAME_DATA.maps.find(m => m.id === duel.game_specific_rules.map);
        
        const taskPayload = { websiteDuelId: duel.id, serverId: server.server_id, serverLink: server.join_link, challenger: p1.linked_game_username, opponent: p2.linked_game_username, map: mapInfo.name, bannedWeapons: (duel.game_specific_rules.banned_weapons || []).map(id => GAME_DATA.weapons.find(w => w.id === id)?.name || id), wager: duel.wager, gameId: RIVALS_GAME_ID };
        await client.query("INSERT INTO tasks (task_type, payload) VALUES ($1, $2)", ['REFEREE_DUEL', JSON.stringify(taskPayload)]);
        
        await client.query('COMMIT');
        sendInboxRefresh(duel.challenger_id.toString() === userId ? duel.opponent_id : duel.challenger_id);
        res.status(200).json({ message: 'Duel started!', serverLink: server.join_link });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[DUEL START] Error starting Rivals duel ${duelId}:`, err);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        client.release();
    }
});

module.exports = router;
