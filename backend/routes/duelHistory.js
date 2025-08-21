// backend/routes/duelHistory.js
const express = require('express');
const db = require('../database/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET the detailed, unified duel history for the logged-in user across all games
router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.userId;

    try {
        const sql = `
            SELECT 
                d.id,
                d.wager,
                d.pot,
                d.status,
                d.winner_id,
                d.challenger_id,
                d.opponent_id,
                d.transcript,
                d.created_at,
                g.name as game_name,
                g.icon_url as game_icon_url,
                challenger_profile.linked_game_username as challenger_username,
                challenger_profile.avatar_url as challenger_avatar,
                opponent_profile.linked_game_username as opponent_username,
                opponent_profile.avatar_url as opponent_avatar
            FROM duels d
            JOIN games g ON d.game_id = g.id
            JOIN user_game_profiles challenger_profile ON d.challenger_id = challenger_profile.user_id AND d.game_id = challenger_profile.game_id
            JOIN user_game_profiles opponent_profile ON d.opponent_id = opponent_profile.user_id AND d.game_id = opponent_profile.game_id
            WHERE 
                (d.challenger_id = $1 OR d.opponent_id = $1) 
                AND d.status IN ('completed', 'canceled', 'declined', 'cheater_forfeit', 'under_review')
            ORDER BY d.created_at DESC
            LIMIT 100;
        `;

        const { rows: history } = await db.query(sql, [userId]);
        
        res.status(200).json(history);

    } catch (err) {
        console.error("Fetch Unified Duel History Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred while fetching your duel history.' });
    }
});

module.exports = router;
