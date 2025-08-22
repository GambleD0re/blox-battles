// backend/routes/admin.js
const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../database/database');
const { authenticateToken, isAdmin, isMasterAdmin, handleValidationErrors } = require('../middleware/auth');
const { getLogs } = require('../middleware/botLogger');
const { sendInboxRefresh } = require('../core/services/notificationService');

const router = express.Router();

const decrementPlayerCount = async (client, duelId) => {
    try {
        const { rows: [duel] } = await client.query('SELECT assigned_server_id FROM duels WHERE id = $1', [duelId]);
        if (duel && duel.assigned_server_id) {
            await client.query('UPDATE game_servers SET player_count = GREATEST(0, player_count - 2) WHERE server_id = $1', [duel.assigned_server_id]);
            console.log(`[PlayerCount] Decremented player count for server ${duel.assigned_server_id} from duel ${duelId} via admin action.`);
        }
    } catch (err) {
        console.error(`[PlayerCount] Failed to decrement player count for duel ${duelId}:`, err);
    }
};

router.get('/system-status', authenticateToken, isMasterAdmin, async (req, res) => {
    try {
        const { rows } = await db.query('SELECT feature_name, is_enabled, disabled_message FROM system_status ORDER BY feature_name');
        res.status(200).json(rows);
    } catch (err) {
        console.error("Admin Get System Status Error:", err);
        res.status(500).json({ message: 'Failed to fetch system status.' });
    }
});

router.put('/system-status', authenticateToken, isMasterAdmin, [
    body('feature_name').isString().notEmpty(),
    body('is_enabled').isBoolean(),
    body('disabled_message').isString().optional({ nullable: true })
], handleValidationErrors, async (req, res) => {
    const { feature_name, is_enabled, disabled_message } = req.body;
    try {
        const sql = `
            UPDATE system_status 
            SET is_enabled = $1, disabled_message = $2 
            WHERE feature_name = $3
        `;
        await db.query(sql, [is_enabled, disabled_message, feature_name]);
        res.status(200).json({ message: `Status for '${feature_name}' updated successfully.` });
    } catch (err) {
        console.error("Admin Update System Status Error:", err);
        res.status(500).json({ message: 'Failed to update system status.' });
    }
});

router.get('/stats', authenticateToken, isAdmin, async (req, res) => {
    try {
        const { rows: [totalUsers] } = await db.query("SELECT COUNT(id)::int as count FROM users");
        const { rows: [gemsInCirculation] } = await db.query("SELECT SUM(gems)::bigint as total FROM users");
        const { rows: [pendingDisputes] } = await db.query("SELECT COUNT(id)::int as count FROM disputes WHERE status = 'pending'");
        const { rows: [pendingPayouts] } = await db.query("SELECT COUNT(id)::int as count FROM payout_requests WHERE status = 'awaiting_approval'");
        const { rows: [taxCollected] } = await db.query("SELECT SUM(tax_collected)::bigint as total FROM duels");

        res.status(200).json({
            totalUsers: totalUsers.count || 0,
            gemsInCirculation: gemsInCirculation.total || 0,
            pendingDisputes: pendingDisputes.count || 0,
            pendingPayouts: pendingPayouts.count || 0,
            taxCollected: taxCollected.total || 0,
        });
    } catch (err) {
        console.error("Admin fetch stats error:", err);
        res.status(500).json({ message: 'Failed to fetch platform statistics.' });
    }
});

router.get('/payout-requests', authenticateToken, isAdmin, async (req, res) => {
    try {
        const sql = `
            SELECT pr.id, pr.user_id, pr.amount_gems, pr.type, pr.destination_address, pr.created_at, u.email, u.username
            FROM payout_requests pr
            JOIN users u ON pr.user_id = u.id
            WHERE pr.status = 'awaiting_approval'
            ORDER BY pr.created_at ASC
        `;
        const { rows: requests } = await db.query(sql);
        res.status(200).json(requests);
    } catch (err) {
        console.error("Admin fetch payout requests error:", err);
        res.status(500).json({ message: 'Failed to fetch payout requests.' });
    }
});

router.get('/users/:userId/details-for-payout/:payoutId', authenticateToken, isAdmin, param('userId').isUUID(), param('payoutId').isUUID(), handleValidationErrors, async (req, res) => {
    const { userId, payoutId } = req.params;
    try {
        const userSql = `SELECT id, email, username, gems, created_at FROM users WHERE id = $1`;
        const { rows: [user] } = await db.query(userSql, [userId]);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const payoutSql = `SELECT amount_gems FROM payout_requests WHERE id = $1 AND user_id = $2`;
        const { rows: [payoutRequest] } = await db.query(payoutSql, [payoutId, userId]);
        if (!payoutRequest) return res.status(404).json({ message: 'Associated payout request not found.' });
        
        const duelHistorySql = `
            SELECT d.id, d.wager, d.winner_id, d.status, d.tax_collected, g.name as game_name,
                   (SELECT wins FROM user_game_profiles WHERE user_id = $1 AND game_id = d.game_id) as wins,
                   (SELECT losses FROM user_game_profiles WHERE user_id = $1 AND game_id = d.game_id) as losses
            FROM duels d
            JOIN games g ON d.game_id = g.id
            WHERE (d.challenger_id = $1 OR d.opponent_id = $1) AND d.status IN ('completed', 'under_review', 'cheater_forfeit')
            ORDER BY d.created_at DESC
            LIMIT 50
        `;
        const { rows: duelHistory } = await db.query(duelHistorySql, [userId]);

        res.status(200).json({
            user: { ...user, balanceBeforeRequest: parseInt(user.gems) + parseInt(payoutRequest.amount_gems), balanceAfterRequest: user.gems },
            duelHistory: duelHistory
        });
    } catch (err) {
        console.error("Admin fetch user details for payout error:", err);
        res.status(500).json({ message: 'Failed to fetch comprehensive user details.' });
    }
});

router.post('/payouts/requests/:id/approve', authenticateToken, isAdmin, param('id').isUUID(), handleValidationErrors, async (req, res) => {
    const requestId = req.params.id;
    const client = await db.getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows: [request] } = await client.query("SELECT * FROM payout_requests WHERE id = $1 AND status = 'awaiting_approval' FOR UPDATE", [requestId]);
        if (!request) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Request not found or not awaiting approval.' });
        }
        await client.query("UPDATE payout_requests SET status = 'approved', updated_at = NOW() WHERE id = $1", [requestId]);
        await client.query(
            `INSERT INTO inbox_messages (user_id, type, title, message, reference_id) VALUES ($1, 'withdrawal_update', 'Withdrawal Approved', 'Your request to withdraw ' || $2 || ' gems has been approved. Please go to your inbox to confirm the payout.', $3)`,
            [request.user_id, request.amount_gems, request.id]
        );
        await client.query('COMMIT');
        sendInboxRefresh(request.user_id);
        res.status(200).json({ message: 'Withdrawal request approved.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Admin approve payout error:", err);
        res.status(500).json({ message: 'Failed to approve request.' });
    } finally {
        client.release();
    }
});

router.post('/payouts/requests/:id/decline', authenticateToken, isAdmin, param('id').isUUID(), body('reason').trim().notEmpty(), handleValidationErrors, async (req, res) => {
    const requestId = req.params.id;
    const { reason } = req.body;
    const client = await db.getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows: [request] } = await client.query("SELECT * FROM payout_requests WHERE id = $1 AND status = 'awaiting_approval' FOR UPDATE", [requestId]);
        if (!request) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Request not found or not awaiting approval.' });
        }
        await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [request.amount_gems, request.user_id]);
        await client.query("UPDATE payout_requests SET status = 'declined', decline_reason = $1, updated_at = NOW() WHERE id = $2", [reason, requestId]);
        await client.query(
            `INSERT INTO inbox_messages (user_id, type, title, message, reference_id) VALUES ($1, 'withdrawal_update', 'Withdrawal Declined', 'Your request to withdraw ' || $2 || ' gems was declined. Reason: "' || $3 || '"', $4)`,
            [request.user_id, request.amount_gems, reason, request.id]
        );
        await client.query('COMMIT');
        sendInboxRefresh(request.user_id);
        res.status(200).json({ message: 'Withdrawal request declined and gems refunded.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Admin decline payout error:", err);
        res.status(500).json({ message: 'Failed to decline request.' });
    } finally {
        client.release();
    }
});

router.get('/disputes', authenticateToken, isAdmin, async (req, res) => {
    try {
        const sql = `
            SELECT 
                d.id, d.duel_id, d.reason, d.has_video_evidence, d.created_at, 
                g.name as game_name,
                reporter_profile.linked_game_username as reporter_username,
                reported_profile.linked_game_username as reported_username
            FROM disputes d
            JOIN duels du ON d.duel_id = du.id
            JOIN games g ON du.game_id = g.id
            JOIN user_game_profiles reporter_profile ON d.reporter_id = reporter_profile.user_id AND du.game_id = reporter_profile.game_id
            JOIN user_game_profiles reported_profile ON d.reported_id = reported_profile.user_id AND du.game_id = reported_profile.game_id
            WHERE d.status = 'pending' 
            ORDER BY d.created_at ASC
        `;
        const { rows: disputes } = await db.query(sql);
        res.status(200).json(disputes);
    } catch (err) {
        console.error("Admin fetch disputes error:", err);
        res.status(500).json({ message: 'Failed to fetch disputes.' });
    }
});

router.post('/disputes/:id/resolve', authenticateToken, isAdmin, param('id').isInt(), body('resolutionType').isIn(['uphold_winner', 'overturn_to_reporter', 'void_refund']), handleValidationErrors, async (req, res) => {
    const disputeId = req.params.id;
    const adminId = req.user.userId;
    const { resolutionType } = req.body;
    const client = await db.getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows: [dispute] } = await client.query("SELECT * FROM disputes WHERE id = $1 AND status != 'resolved' FOR UPDATE", [disputeId]);
        if (!dispute) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Dispute not found or already resolved.' }); }
        
        const { rows: [duel] } = await client.query('SELECT * FROM duels WHERE id = $1 FOR UPDATE', [dispute.duel_id]);
        if (!duel) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Associated duel not found.' }); }

        let resolutionMessage = '';
        switch (resolutionType) {
            case 'uphold_winner':
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.winner_id]);
                const loserId = duel.winner_id.toString() === duel.challenger_id.toString() ? duel.opponent_id : duel.challenger_id;
                await client.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.winner_id, duel.game_id]);
                await client.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [loserId, duel.game_id]);
                resolutionMessage = `Winner upheld. Pot of ${duel.pot} paid to original winner.`;
                break;
            case 'overturn_to_reporter':
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, dispute.reporter_id]);
                await client.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [dispute.reporter_id, duel.game_id]);
                await client.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [dispute.reported_id, duel.game_id]);
                await client.query('UPDATE duels SET winner_id = $1 WHERE id = $2', [dispute.reporter_id, duel.id]);
                resolutionMessage = `Result overturned. Pot of ${duel.pot} paid to reporter.`;
                break;
            case 'void_refund':
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.challenger_id]);
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.opponent_id]);
                await client.query('UPDATE duels SET tax_collected = 0 WHERE id = $1', [duel.id]);
                resolutionMessage = `Duel voided. Wager of ${duel.wager} refunded to both players.`;
                break;
        }
        await client.query("UPDATE duels SET status = 'completed' WHERE id = $1", [duel.id]);
        await client.query("UPDATE disputes SET status = 'resolved', resolution = $1, resolved_at = NOW(), admin_resolver_id = $2 WHERE id = $3", [resolutionMessage, adminId, disputeId]);
        
        await decrementPlayerCount(client, duel.id);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Dispute resolved successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(`Admin Resolve Dispute Error:`, err);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        client.release();
    }
});

router.get('/users', authenticateToken, isAdmin, 
    query('search').optional().trim(),
    query('status').optional().isIn(['active', 'banned', 'terminated']),
    async (req, res) => {
    try {
        const { search, status } = req.query;
        let sql = `SELECT id, email, username, gems, is_admin, status, ban_applied_at, ban_expires_at, ban_reason FROM users`;
        const params = [];
        const conditions = [];
        let paramIndex = 1;

        if (search) {
            conditions.push(`(email ILIKE $${paramIndex} OR username ILIKE $${paramIndex})`);
            params.push(`%${search}%`);
            paramIndex++;
        }
        if (status) {
            conditions.push(`status = $${paramIndex}`);
            params.push(status);
            paramIndex++;
        }

        if (conditions.length > 0) {
            sql += ` WHERE ` + conditions.join(' AND ');
        }
        sql += ` ORDER BY created_at DESC`;
        
        const { rows: users } = await db.query(sql, params);
        res.json(users);
    } catch (err) {
        console.error("Admin fetch users error:", err);
        res.status(500).json({ message: 'Failed to fetch users.' });
    }
});

router.post('/users/:id/gems', authenticateToken, isAdmin, param('id').isUUID(), body('amount').isInt(), handleValidationErrors, async (req, res) => {
    try {
        await db.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [req.body.amount, req.params.id]);
        res.status(200).json({ message: `Successfully updated gems for user ${req.params.id}.` });
    } catch (err) {
        console.error("Admin update gems error:", err);
        res.status(500).json({ message: 'Failed to update gems.' });
    }
});

router.post('/users/:id/ban', authenticateToken, isAdmin,
    param('id').isUUID(),
    body('reason').trim().notEmpty(),
    body('duration_hours').optional({ checkFalsy: true }).isInt({ gt: 0 }).withMessage('Duration must be a positive number of hours.'),
    handleValidationErrors,
    async (req, res) => {
        const { id } = req.params;
        const { reason, duration_hours } = req.body;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            
            const banExpiresAtClause = duration_hours ? `NOW() + INTERVAL '${parseInt(duration_hours, 10)} hours'` : 'NULL';
            const banSql = `UPDATE users SET status = 'banned', ban_reason = $1, ban_expires_at = ${banExpiresAtClause}, ban_applied_at = NOW() WHERE id = $2`;
            await client.query(banSql, [reason, id]);
            
            // [ADDED] Cancel pending payout requests for the banned user
            await client.query("UPDATE payout_requests SET status = 'canceled_by_user' WHERE user_id = $1 AND status = 'awaiting_approval'", [id]);
            
            // [ADDED] Cancel pending duels and refund opponents
            const { rows: pendingDuels } = await client.query("SELECT * FROM duels WHERE (challenger_id = $1 OR opponent_id = $1) AND status IN ('pending', 'accepted') FOR UPDATE", [id]);
            for (const duel of pendingDuels) {
                if (duel.status === 'accepted') {
                    const opponentId = duel.challenger_id.toString() === id ? duel.opponent_id : duel.challenger_id;
                    await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, opponentId]);
                }
                if(duel.status === 'started' || duel.status === 'accepted'){
                    await decrementPlayerCount(client, duel.id);
                }
                await client.query("UPDATE duels SET status = 'canceled' WHERE id = $1", [duel.id]);
            }
            
            await client.query('COMMIT');
            res.status(200).json({ message: `User ${id} has been banned and their pending actions canceled.` });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error("Admin ban user error:", err);
            res.status(500).json({ message: 'Failed to ban user.' });
        } finally {
            client.release();
        }
    }
);

router.delete('/users/:id/ban', authenticateToken, isAdmin, param('id').isUUID(), handleValidationErrors, async (req, res) => {
    try {
        await db.query(`UPDATE users SET status = 'active', ban_reason = NULL, ban_expires_at = NULL, ban_applied_at = NULL WHERE id = $1`, [req.params.id]);
        res.status(200).json({ message: `User ${req.params.id} has been unbanned.` });
    } catch (err) {
        console.error("Admin unban user error:", err);
        res.status(500).json({ message: 'Failed to unban user.' });
    }
});

router.delete('/users/:id', authenticateToken, isAdmin, param('id').isUUID(), handleValidationErrors, async (req, res) => {
    try {
        await db.query("UPDATE users SET status = 'terminated', gems = 0 WHERE id = $1", [req.params.id]);
        res.status(200).json({ message: `User ${req.params.id} has been terminated.` });
    } catch (err) {
        console.error("Admin terminate user error:", err);
        res.status(500).json({ message: 'Failed to terminate user.' });
    }
});

router.get('/logs', authenticateToken, isAdmin, (req, res) => {
    res.json(getLogs());
});

router.post('/tasks', authenticateToken, isAdmin, body('task_type').notEmpty(), body('payload').isJSON(), handleValidationErrors, async (req, res) => {
    try {
        await db.query('INSERT INTO tasks (task_type, payload) VALUES ($1, $2)', [req.body.task_type, req.body.payload]);
        res.status(201).json({ message: 'Task created successfully.' });
    } catch (err) {
        console.error("Admin create task error:", err);
        res.status(500).json({ message: 'Failed to create task.' });
    }
});

module.exports = router;
