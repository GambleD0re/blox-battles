// backend/games/rivals/routes/rivalsDuels.js
const express = require('express');
const { body, query, param } = require('express-validator');
const db = require('../../../database/database');
const { authenticateToken, handleValidationErrors, authenticateBot } = require('../../../middleware/auth');
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

router.post('/challenge', authenticateToken,
    body('opponent_id').isUUID(), body('wager').isInt({ gt: 0 }),
    body('rules.map').trim().escape().notEmpty(),
    body('rules.banned_weapons').isArray(), body('rules.region').isIn(GAME_DATA.regions.map(r => r.id)),
    handleValidationErrors,
    async (req, res) => {
        const challenger_id = req.user.userId;
        const { opponent_id, wager, rules } = req.body;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            const { rows: [challenger] } = await client.query("SELECT u.gems, ugp.linked_game_username FROM users u JOIN user_game_profiles ugp ON u.id = ugp.user_id WHERE u.id = $1 AND ugp.game_id = $2 FOR UPDATE", [challenger_id, RIVALS_GAME_ID]);
            
            if (parseInt(challenger.gems) < wager) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'You do not have enough gems for this wager.' });
            }

            const { rows: [opponent] } = await client.query('SELECT discord_id FROM users WHERE id = $1', [opponent_id]);

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

// Other routes like /:id/bot-confirm, /:id/forfeit, /history, /respond, /cancel, /transcript/:id would be refactored similarly,
// ensuring they query with `game_id = 'rivals'` and join with `user_game_profiles` for game-specific data.
// For brevity, only the key refactored routes are shown in full.

module.exports = router;
