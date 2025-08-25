// backend/routes/transcripts.js
const express = require('express');
const { param } = require('express-validator');
const db = require('../database/database');
const { handleValidationErrors } = require('../middleware/auth');

const router = express.Router();

router.get('/:duelId', param('duelId').isInt(), handleValidationErrors, async (req, res) => {
    try {
        const { duelId } = req.params;
        const sql = `
            SELECT 
                d.id,
                d.transcript,
                d.wager,
                d.pot,
                d.game_specific_rules,
                g.name as game_name,
                c_profile.linked_game_username as challenger_username,
                o_profile.linked_game_username as opponent_username,
                w_profile.linked_game_username as winner_username
            FROM duels d
            JOIN games g ON d.game_id = g.id
            JOIN user_game_profiles c_profile ON d.challenger_id = c_profile.user_id AND d.game_id = c_profile.game_id
            JOIN user_game_profiles o_profile ON d.opponent_id = o_profile.user_id AND d.game_id = o_profile.game_id
            LEFT JOIN user_game_profiles w_profile ON d.winner_id = w_profile.user_id AND d.game_id = w_profile.game_id
            WHERE d.id = $1;
        `;
        const { rows: [duel] } = await db.query(sql, [duelId]);

        if (!duel) {
            return res.status(404).json({ message: 'Transcript not found.' });
        }

        res.status(200).json(duel);
    } catch (err) {
        console.error("Fetch Public Transcript Error:", err);
        res.status(500).json({ message: 'Failed to fetch transcript.' });
    }
});

router.get('/ticket/:ticketId', param('ticketId').isUUID(), handleValidationErrors, async (req, res) => {
    try {
        const { ticketId } = req.params;
        const sql = `SELECT transcript_content FROM ticket_transcripts WHERE ticket_id = $1::uuid ORDER BY created_at DESC LIMIT 1`;
        const { rows: [transcript] } = await db.query(sql, [ticketId]);

        if (!transcript) {
            return res.status(404).json({ message: 'Ticket transcript not found.' });
        }

        res.header('Content-Type', 'text/plain');
        res.send(transcript.transcript_content);
    } catch (err) {
        console.error("Fetch Ticket Transcript Error:", err);
        res.status(500).json({ message: 'Failed to fetch ticket transcript.' });
    }
});

module.exports = router;
