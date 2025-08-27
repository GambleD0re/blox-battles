// backend/games/rivals/routes/rivalsLeaderboard.js
const express = require('express');
const db = require('../../../database/database');
const { authenticateToken } = require('../../../middleware/auth');

const router = express.Router();
const RIVALS_GAME_ID = 'rivals';

router.get('/', authenticateToken, async (req, res) => {
    try {
        const sql = `
            SELECT 
                ugp.wins,
                ugp.losses,
                u.username
            FROM user_game_profiles ugp
            JOIN users u ON ugp.user_id = u.id
            WHERE ugp.game_id = $1
            ORDER BY ugp.wins DESC, ugp.losses ASC
            LIMIT 10;
        `;

        const { rows: leaderboard } = await db.query(sql, [RIVALS_GAME_ID]);
        res.status(200).json(leaderboard);
    } catch (err) {
        console.error("Fetch Rivals Leaderboard Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred while fetching the leaderboard.' });
    }
});

module.exports = router;
