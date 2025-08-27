// backend/core/routes/users.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body } = require('express-validator');
const db = require('../../database/database');
const { authenticateToken, handleValidationErrors, validatePassword } = require('../../middleware/auth');

const router = express.Router();
const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET;

router.get('/user-data', authenticateToken, async (req, res) => {
    try {
        const userSql = `
            SELECT id, email, username, google_id, gems, is_admin, is_master_admin,
                   discord_id, discord_username, created_at, password_last_updated, 
                   discord_notifications_enabled, accepting_challenges, status, 
                   ban_reason, ban_applied_at, ban_expires_at, is_email_verified, is_username_set
            FROM users WHERE id = $1
        `;
        const { rows: [user] } = await db.query(userSql, [req.user.userId]);
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.status(200).json(user);
    } catch(err) {
        console.error("Get User Data Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

router.post('/user/set-username', authenticateToken,
    [
        body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters.').matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores.')
    ],
    handleValidationErrors,
    async (req, res) => {
        const { username } = req.body;
        const userId = req.user.userId;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            const { rows: [user] } = await client.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [userId]);

            if (user.is_username_set) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Username has already been set.' });
            }

            const { rows: [existingUser] } = await client.query('SELECT id FROM users WHERE username ILIKE $1', [username]);
            if (existingUser) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'This username is already taken.' });
            }

            await client.query('UPDATE users SET username = $1, is_username_set = TRUE WHERE id = $2', [username, userId]);
            
            const payload = {
                userId: user.id,
                email: user.email,
                username: username,
                isAdmin: user.is_admin,
                isMasterAdmin: user.is_master_admin,
                is_username_set: true,
            };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: '1d' });

            await client.query('COMMIT');
            res.status(200).json({ message: 'Username set successfully!', token });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Set Username Error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        } finally {
            client.release();
        }
    }
);

router.put('/user/password', authenticateToken,
    body('newPassword').notEmpty().withMessage('New password is required.'),
    handleValidationErrors,
    async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        const passwordPolicy = validatePassword(newPassword);
        if (!passwordPolicy.valid) return res.status(400).json({ message: passwordPolicy.message });
        try {
            const { rows: [user] } = await db.query('SELECT * FROM users WHERE id = $1', [req.user.userId]);
            if (!user.password_hash) return res.status(403).json({ message: 'Cannot change password for Google-linked accounts.' });
            const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isMatch) return res.status(401).json({ message: 'Incorrect current password.' });
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
        await db.query('UPDATE users SET discord_id = NULL, discord_username = NULL WHERE id = $1', [req.user.userId]);
        res.status(200).json({ message: 'Discord account unlinked successfully.' });
    } catch (err) {
        console.error("Unlink Discord Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

router.delete('/user/delete/account', authenticateToken, body('password').optional(), handleValidationErrors, async (req, res) => {
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

        if (user.google_id) return await deleteUser();
        if (!password) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Password is required to delete your account.' }); }
        
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) { await client.query('ROLLBACK'); return res.status(401).json({ message: 'Incorrect password.' }); }

        await deleteUser();
    } catch(err) {
        await client.query('ROLLBACK');
        console.error("Delete Account Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        client.release();
    }
});

router.put('/user/notification-preference', authenticateToken, body('enabled').isBoolean(), handleValidationErrors, async (req, res) => {
    try {
        await db.query('UPDATE users SET discord_notifications_enabled = $1 WHERE id = $2', [req.body.enabled, req.user.userId]);
        res.status(200).json({ message: 'Notification preferences updated.' });
    } catch (err) {
        console.error("Update Notification Preference Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

router.put('/user/challenge-preference', authenticateToken, body('enabled').isBoolean(), handleValidationErrors, async (req, res) => {
    try {
        await db.query('UPDATE users SET accepting_challenges = $1 WHERE id = $2', [req.body.enabled, req.user.userId]);
        res.status(200).json({ message: 'Challenge preferences updated.' });
    } catch (err) {
        console.error("Update Challenge Preference Error:", err.message);
        res.status(500).json({ message: 'An internal server error occurred.' });
    }
});

module.exports = router;
