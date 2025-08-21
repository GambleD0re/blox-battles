// backend/core/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const db = require('../../database/database');
const { authenticateToken, handleValidationErrors, validatePassword } = require('../../middleware/auth');

const router = express.Router();
const saltRounds = 10;

// Endpoint to get the main, game-agnostic user data
router.get('/user-data', authenticateToken, async (req, res) => {
    try {
        const userSql = `
            SELECT id, email, username, google_id, gems, is_admin, 
                   discord_id, discord_username,
                   created_at, password_last_updated, discord_notifications_enabled,
                   accepting_challenges,
                   status, ban_reason, ban_applied_at, ban_expires_at
            FROM users WHERE id = $1
        `;
        const { rows: [user] } = await db.query(userSql, [req.user.userId]);

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        
        // System status is now fetched on the frontend, so we don't need to attach it here.
        res.status(200).json(user);

    } catch(err) {
        console.error("Get User Data Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

router.put('/user/notification-preference', authenticateToken,
    body('enabled').isBoolean().withMessage('A boolean value for "enabled" is required.'),
    handleValidationErrors,
    async (req, res) => {
        const { enabled } = req.body;
        try {
            await db.query('UPDATE users SET discord_notifications_enabled = $1 WHERE id = $2', [enabled, req.user.userId]);
            res.status(200).json({ message: 'Notification preferences updated successfully.' });
        } catch (err) {
            console.error("Update Notification Preference Error:", err.message);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.put('/user/challenge-preference', authenticateToken,
    body('enabled').isBoolean().withMessage('A boolean value for "enabled" is required.'),
    handleValidationErrors,
    async (req, res) => {
        const { enabled } = req.body;
        try {
            await db.query('UPDATE users SET accepting_challenges = $1 WHERE id = $2', [enabled, req.user.userId]);
            res.status(200).json({ message: 'Challenge preferences updated successfully.' });
        } catch (err) {
            console.error("Update Challenge Preference Error:", err.message);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.put('/user/password', authenticateToken,
    body('newPassword').notEmpty().withMessage('New password is required.'),
    handleValidationErrors,
    async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        
        const passwordPolicy = validatePassword(newPassword);
        if (!passwordPolicy.valid) {
            return res.status(400).json({ message: passwordPolicy.message });
        }

        try {
            const { rows: [user] } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
            if (!user) { return res.status(404).json({ message: 'User not found.' }); }
            if (!user.password_hash) { return res.status(403).json({ message: 'Cannot change password for Google-linked accounts.' }); }

            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) { return res.status(401).json({ message: 'Incorrect current password.' }); }
            
            const hash = await bcrypt.hash(newPassword, saltRounds);
            await db.query('UPDATE users SET password_hash = $1, password_last_updated = NOW() WHERE id = $2', [hash, req.user.userId]);
            res.status(200).json({ message: 'Password changed successfully!' });
        } catch(err) {
            console.error("Change Password Error:", err.message);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.post('/user/unlink/discord', authenticateToken, async (req, res) => {
    try {
        await db.query(
            'UPDATE users SET discord_id = NULL, discord_username = NULL WHERE id = $1',
            [req.user.userId]
        );
        res.status(200).json({ message: 'Discord account unlinked successfully.' });
    } catch(err) {
        console.error("Unlink Discord Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

router.delete('/user/delete/account', authenticateToken, 
    body('password').optional(),
    handleValidationErrors,
    async (req, res) => {
        const { password } = req.body;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            const { rows: [user] } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [req.user.userId]);
            if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'User not found.' }); }

            const deleteUser = async () => {
                await client.query('DELETE FROM users WHERE id = $1', [req.user.userId]);
                await client.query('COMMIT');
                res.status(200).json({ message: 'Account deleted successfully.' });
            };

            if (user.google_id) {
                return await deleteUser();
            }
            
            if (!password) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Password is required to delete your account.' });
            }
            
            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                await client.query('ROLLBACK');
                return res.status(401).json({ message: 'Incorrect password.' });
            }

            await deleteUser();
        } catch(err) {
            await client.query('ROLLBACK');
            console.error("Delete Account Error:", err.message);
            res.status(500).json({ message: 'An internal server error occurred.' });
        } finally {
            client.release();
        }
    }
);

module.exports = router;
