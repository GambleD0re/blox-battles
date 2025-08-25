// backend/games/rivals/routes/rivalsQueue.js
const express = require('express');
const { body } = require('express-validator');
const db = require('../../../database/database');
const { authenticateToken, handleValidationErrors } = require('../../../middleware/auth');
const GAME_DATA = require('../data/rivalsGameData');

const router = express.Router();
const RIVALS_GAME_ID = 'rivals';
const QUEUE_LEAVE_COOLDOWN_SECONDS = parseInt(process.env.QUEUE_LEAVE_COOLDOWN_SECONDS || '60', 10);

router.get('/status', authenticateToken, async (req, res) => {
    try {
        const { rows: [queueEntry] } = await db.query('SELECT * FROM random_queue_entries WHERE user_id = $1 AND game_id = $2', [req.user.userId, RIVALS_GAME_ID]);
        res.status(200).json(queueEntry || null);
    } catch (err) {
        console.error("Get Rivals Queue Status Error:", err);
        res.status(500).json({ message: 'Failed to retrieve queue status.' });
    }
});

router.post('/join', authenticateToken,
    [
        body('wager').isInt({ gt: 0 }),
        body('preferences.region').isIn(GAME_DATA.regions.map(r => r.id)),
        body('preferences.banned_map').isString().notEmpty(),
        body('preferences.banned_weapons').isArray({ min: 0, max: 2 })
    ],
    handleValidationErrors,
    async (req, res) => {
        const { wager, preferences } = req.body;
        const userId = req.user.userId;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            const { rows: [user] } = await client.query(`SELECT gems, last_queue_leave_at FROM users WHERE id = $1 FOR UPDATE`, [userId]);

            if (user.last_queue_leave_at) {
                const secondsSinceLeave = (new Date().getTime() - new Date(user.last_queue_leave_at).getTime()) / 1000;
                if (secondsSinceLeave < QUEUE_LEAVE_COOLDOWN_SECONDS) {
                    await client.query('ROLLBACK');
                    return res.status(429).json({ message: `You must wait ${Math.ceil(QUEUE_LEAVE_COOLDOWN_SECONDS - secondsSinceLeave)} more seconds before joining again.` });
                }
            }

            if (parseInt(user.gems) < parseInt(wager)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Insufficient gems for this wager.' });
            }

            const insertSql = `
                INSERT INTO random_queue_entries (user_id, game_id, region, wager, game_specific_preferences)
                VALUES ($1, $2, $3, $4, $5) ON CONFLICT (user_id) DO NOTHING
            `;
            await client.query(insertSql, [userId, RIVALS_GAME_ID, preferences.region, wager, JSON.stringify(preferences)]);
            
            await client.query('COMMIT');
            res.status(200).json({ message: 'You have joined the Rivals queue.' });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Join Rivals Queue Error:", err);
            res.status(500).json({ message: 'An error occurred.' });
        } finally {
            client.release();
        }
    }
);

router.post('/leave', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const client = await db.getPool().connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM random_queue_entries WHERE user_id = $1 AND game_id = $2', [userId, RIVALS_GAME_ID]);
        await client.query('UPDATE users SET last_queue_leave_at = NOW() WHERE id = $1', [userId]);
        await client.query('COMMIT');
        res.status(200).json({ message: 'You have left the queue.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Leave Rivals Queue Error:", err);
        res.status(500).json({ message: 'An error occurred.' });
    } finally {
        client.release();
    }
});

module.exports = router;
