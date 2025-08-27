// backend/games/rivals/routes/rivalsAdmin.js
const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../../../database/database');
const { authenticateToken, isAdmin, isMasterAdmin, handleValidationErrors } = require('../../../middleware/auth');
const crypto = require('crypto');

const router = express.Router();
const RIVALS_GAME_ID = 'rivals';

router.post('/tournaments', authenticateToken, isAdmin, [
    body('name').trim().notEmpty(),
    body('region').trim().notEmpty(),
    body('assigned_bot_id').trim().notEmpty(),
    body('private_server_link').isURL(),
    body('buy_in_amount').isInt({ gt: -1 }),
    body('prize_pool_gems').isInt({ gt: 0 }),
    body('registration_opens_at').isISO8601(),
    body('starts_at').isISO8601(),
    body('rules').isObject(),
    body('prize_distribution').isObject(),
], handleValidationErrors, async (req, res) => {
    const { name, region, assigned_bot_id, private_server_link, buy_in_amount, prize_pool_gems, registration_opens_at, starts_at, rules, prize_distribution } = req.body;
    try {
        const tournamentId = crypto.randomUUID();
        const sql = `
            INSERT INTO tournaments (id, game_id, name, region, assigned_bot_id, private_server_link, buy_in_amount, prize_pool_gems, registration_opens_at, starts_at, rules, prize_distribution)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;
        await db.query(sql, [tournamentId, RIVALS_GAME_ID, name, region, assigned_bot_id, private_server_link, buy_in_amount, prize_pool_gems, registration_opens_at, starts_at, JSON.stringify(rules), JSON.stringify(prize_distribution)]);
        res.status(201).json({ message: 'Rivals tournament created successfully.', tournamentId });
    } catch (err) {
        console.error("Admin Create Rivals Tournament Error:", err);
        res.status(500).json({ message: 'Failed to create tournament.' });
    }
});

router.get('/tournaments', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { rows } = await db.query("SELECT id, name, status, starts_at FROM tournaments WHERE game_id = $1 ORDER BY created_at DESC", [RIVALS_GAME_ID]);
        res.status(200).json(rows);
    } catch (err) {
        console.error("Admin Fetch Rivals Tournaments Error:", err);
        res.status(500).json({ message: 'Failed to fetch tournaments.' });
    }
});

router.delete('/tournaments/:id', authenticateToken, isAdmin, param('id').isUUID(), handleValidationErrors, async (req, res) => {
    const tournamentId = req.params.id;
    const client = await db.getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows: [tournament] } = await client.query("SELECT * FROM tournaments WHERE id = $1 AND game_id = $2 AND status IN ('scheduled', 'registration_open') FOR UPDATE", [tournamentId, RIVALS_GAME_ID]);
        if (!tournament) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Tournament not found or has already started.' });
        }
        
        const { rows: participants } = await client.query("SELECT user_id FROM tournament_participants WHERE tournament_id = $1", [tournamentId]);
        for (const participant of participants) {
            await client.query("UPDATE users SET gems = gems + $1 WHERE id = $2", [tournament.buy_in_amount, participant.user_id]);
            await client.query(
                "INSERT INTO transaction_history (user_id, game_id, type, amount_gems, description, reference_id) VALUES ($1, $2, $3, $4, $5, $6)",
                [participant.user_id, RIVALS_GAME_ID, 'tournament_buy_in', tournament.buy_in_amount, `Refund for canceled tournament: ${tournament.name}`, tournamentId]
            );
        }
        
        await client.query("UPDATE tournaments SET status = 'canceled' WHERE id = $1", [tournamentId]);
        
        await client.query('COMMIT');
        res.status(200).json({ message: 'Tournament canceled and all players refunded.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Admin Cancel Rivals Tournament Error:", err);
        res.status(500).json({ message: 'Failed to cancel tournament.' });
    } finally {
        client.release();
    }
});

module.exports = router;
