// backend/core/routes/inbox.js
const express = require('express');
const db = require('../../database/database');
const { authenticateToken } = require('../../middleware/auth');
const rivalsGameData = require('../../games/rivals/data/rivalsGameData'); // Specific for Rivals duel data

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    let notifications = [];

    try {
        // Fetch Rivals duels
        const duelsSql = `
            SELECT 
                d.id, d.wager, d.status, d.challenger_id, d.server_invite_link, d.game_specific_rules, d.created_at,
                cp.linked_game_username as challenger_username,
                op.linked_game_username as opponent_username
            FROM duels d
            JOIN user_game_profiles cp ON d.challenger_id = cp.user_id AND d.game_id = cp.game_id
            JOIN user_game_profiles op ON d.opponent_id = op.user_id AND d.game_id = op.game_id
            WHERE 
                d.game_id = 'rivals' AND
                (d.challenger_id = $1 OR d.opponent_id = $1) AND
                d.status IN ('pending', 'accepted', 'started', 'under_review')
        `;
        const { rows: duels } = await db.query(duelsSql, [userId]);
        
        const duelNotifications = duels.map(duel => {
            const mapInfo = rivalsGameData.maps.find(m => m.id === duel.game_specific_rules.map);
            return {
                id: `duel-${duel.id}`,
                type: 'duel',
                game_id: 'rivals',
                timestamp: duel.created_at,
                data: {
                    ...duel,
                    map_name: mapInfo ? mapInfo.name : duel.game_specific_rules.map,
                    type: duel.challenger_id.toString() === userId ? 'outgoing' : 'incoming',
                    userId: userId
                }
            };
        });
        notifications.push(...duelNotifications);

        // Fetch other global notifications (withdrawals, etc.) in the future here

        notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.status(200).json(notifications);

    } catch (err) {
        console.error("Fetch Inbox Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred while fetching your inbox.' });
    }
});

module.exports = router;
