// backend/core/routes/inbox.js
const express = require('express');
const db = require('../../database/database');
const { authenticateToken } = require('../../middleware/auth');
const rivalsGameData = require('../../games/rivals/data/rivalsGameData');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const client = await db.getPool().connect();
    let notifications = [];

    try {
        // 1. Fetch Rivals duels
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
        const { rows: duels } = await client.query(duelsSql, [userId]);
        
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
        
        // [ADDED] 2. Fetch pending and approved withdrawal requests
        const withdrawalsSql = `
            SELECT id, amount_gems, status, created_at FROM payout_requests
            WHERE user_id = $1 AND status IN ('awaiting_approval', 'approved')
        `;
        const { rows: withdrawals } = await client.query(withdrawalsSql, [userId]);
        withdrawals.forEach(req => {
            notifications.push({
                id: `withdrawal-${req.id}`,
                type: 'withdrawal_request',
                timestamp: req.created_at,
                data: req
            });
        });

        // [ADDED] 3. Fetch unread inbox messages (admin, discord link, etc.)
        const messagesSql = `
            SELECT id, type, title, message, reference_id, created_at FROM inbox_messages
            WHERE user_id = $1 AND is_read = FALSE
        `;
        const { rows: messages } = await client.query(messagesSql, [userId]);
        messages.forEach(msg => {
            notifications.push({
                id: `message-${msg.id}`,
                type: msg.type,
                timestamp: msg.created_at,
                data: msg
            });
        });


        notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        res.status(200).json(notifications);

    } catch (err) {
        console.error("Fetch Inbox Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred while fetching your inbox.' });
    } finally {
        client.release();
    }
});

module.exports = router;
