// backend/core/routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { body } = require('express-validator');
const { handleValidationErrors, validatePassword } = require('../../middleware/auth');
const db = require('../../database/database');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

const jwtSecret = process.env.JWT_SECRET;

router.post('/register',
    [
        body('username').trim().isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters.').matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, and underscores.'),
        body('email').isEmail().withMessage('Please enter a valid email.').normalizeEmail(),
        body('password').custom(value => {
            const validation = validatePassword(value);
            if (!validation.valid) throw new Error(validation.message);
            return true;
        })
    ],
    handleValidationErrors,
    async (req, res) => {
        const { username, email, password } = req.body;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');

            const { rows: [existingUserByEmail] } = await client.query('SELECT * FROM users WHERE email = $1', [email]);
            if (existingUserByEmail) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'An account with this email already exists.' });
            }

            const { rows: [existingUserByUsername] } = await client.query('SELECT * FROM users WHERE username ILIKE $1', [username]);
            if (existingUserByUsername) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'This username is already taken.' });
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const newUserId = crypto.randomUUID();
            const verificationToken = crypto.randomBytes(32).toString('hex');
            
            await client.query(
                'INSERT INTO users (id, username, email, password_hash, is_admin, email_verification_token, is_email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7)', 
                [newUserId, username, email, hashedPassword, false, verificationToken, false]
            );

            await sendVerificationEmail(email, verificationToken);
            
            await client.query('COMMIT');
            
            res.status(201).json({ message: 'User registered successfully! Please check your email to verify your account.' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Registration error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        } finally {
            client.release();
        }
    }
);

router.post('/verify-email', 
    [ body('token').isHexadecimal().withMessage('Invalid token format.') ],
    handleValidationErrors,
    async (req, res) => {
        const { token } = req.body;
        try {
            const { rows: [user] } = await db.query('SELECT * FROM users WHERE email_verification_token = $1', [token]);

            if (!user) {
                return res.status(400).json({ message: 'Invalid or expired verification token. Please try registering again or request a new link.' });
            }

            await db.query('UPDATE users SET is_email_verified = TRUE, email_verification_token = NULL WHERE id = $1', [user.id]);
            res.status(200).json({ message: 'Email verified successfully! You can now log in.' });
        } catch (error) {
            console.error('Email verification error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.post('/resend-verification',
    [ body('email').isEmail().normalizeEmail() ],
    handleValidationErrors,
    async (req, res) => {
        const { email } = req.body;
        try {
            const { rows: [user] } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            if (user && !user.is_email_verified) {
                const verificationToken = crypto.randomBytes(32).toString('hex');
                await db.query('UPDATE users SET email_verification_token = $1 WHERE id = $2', [verificationToken, user.id]);
                await sendVerificationEmail(user.email, verificationToken);
            }
            res.status(200).json({ message: 'If an unverified account with that email exists, a new verification link has been sent.' });
        } catch (error) {
            console.error('Resend verification error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.post('/login',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').notEmpty()
    ],
    handleValidationErrors,
    async (req, res) => {
        const { email, password } = req.body;
        try {
            const { rows: [user] } = await db.query('SELECT * FROM users WHERE email = $1', [email]);

            if (!user || !user.password_hash) {
                return res.status(401).json({ message: 'Incorrect email or password.' });
            }
            
            if (!user.is_email_verified) {
                return res.status(403).json({ message: 'Please verify your email address before logging in.', needsVerification: true });
            }

            if (user.status !== 'active') {
                if (user.status === 'banned') return res.status(403).json({ message: 'This account is currently banned.' });
                if (user.status === 'terminated') return res.status(403).json({ message: 'This account has been terminated.' });
                return res.status(403).json({ message: 'This account is not active.' });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ message: 'Incorrect email or password.' });
            }
            
            const payload = {
                userId: user.id,
                email: user.email,
                username: user.username,
                isAdmin: user.is_admin,
                isMasterAdmin: user.is_master_admin,
                is_username_set: user.is_username_set // [FIXED] Add this flag to the JWT payload
            };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: '1d' });

            res.json({ token, username: payload.username });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.post('/forgot-password',
    [ body('email').isEmail().normalizeEmail() ],
    handleValidationErrors,
    async (req, res) => {
        const { email } = req.body;
        try {
            const { rows: [user] } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
            
            if (user && !user.google_id) {
                const resetToken = crypto.randomBytes(32).toString('hex');
                const expires = new Date(Date.now() + 3600000);
                await db.query('UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3', [resetToken, expires, user.id]);
                await sendPasswordResetEmail(user.email, resetToken);
            }
            
            res.status(200).json({ message: 'If an account with that email exists, a password reset link has been sent.' });
        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.post('/reset-password',
    [
        body('token').isHexadecimal().withMessage('Invalid token format.'),
        body('password').custom(value => {
            const validation = validatePassword(value);
            if (!validation.valid) throw new Error(validation.message);
            return true;
        })
    ],
    handleValidationErrors,
    async (req, res) => {
        const { token, password } = req.body;
        try {
            const { rows: [user] } = await db.query('SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()', [token]);
            
            if (!user) {
                return res.status(400).json({ message: 'Password reset token is invalid or has expired.' });
            }
            
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.query('UPDATE users SET password_hash = $1, password_reset_token = NULL, password_reset_expires = NULL, password_last_updated = NOW() WHERE id = $2', [hashedPassword, user.id]);
            
            res.status(200).json({ message: 'Password has been reset successfully. You can now log in with your new password.' });
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/', session: false }),
    async (req, res) => {
        try {
            const user = req.user;
            
            const payload = {
                userId: user.id,
                email: user.email,
                username: user.username,
                isAdmin: user.is_admin,
                isMasterAdmin: user.is_master_admin,
                is_username_set: user.is_username_set // [FIXED] Add this flag to the JWT payload
            };
            const token = jwt.sign(payload, jwtSecret, { expiresIn: '1d' });

            const frontendUrl = process.env.SERVER_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/?token=${token}`);
        } catch (error) {
            console.error('Google callback error:', error);
            const frontendUrl = process.env.SERVER_URL || 'http://localhost:3000';
            res.redirect(`${frontendUrl}/signin?error=authentication_failed`);
        }
    }
);

router.post('/logout', (req, res) => {
    res.status(200).json({ message: 'Logout handled client-side.' });
});

module.exports = router;
