// backend/core/routes/discord.js
const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../database/database');
const { authenticateToken, authenticateBot, handleValidationErrors } = require('../../middleware/auth');
const { sendInboxRefresh } = require('../services/notificationService');

const router = express.Router();

router.get('/user-profile/:discordId',
    authenticateBot,
    [ param('discordId').isString().notEmpty().withMessage('Discord ID is required.') ],
    handleValidationErrors,
    async (req, res) => {
        const { discordId } = req.params;
        try {
            const { rows: [user] } = await db.query('SELECT id, username, email, gems, created_at, status FROM users WHERE discord_id = $1', [discordId]);

            if (!user) {
                return res.status(404).json({ message: 'No Blox Battles account is linked to this Discord user.' });
            }

            const { rows: gameProfiles } = await db.query(
                `SELECT g.name as game_name, ugp.linked_game_username, ugp.wins, ugp.losses, ugp.avatar_url
                 FROM user_game_profiles ugp
                 JOIN games g ON ugp.game_id = g.id
                 WHERE ugp.user_id = $1`,
                [user.id]
            );
            
            res.status(200).json({ user, gameProfiles });
        } catch (error) {
            console.error("Discord Get User Profile Error:", error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.post('/tickets',
    authenticateBot,
    [
        body('discordId').isString().notEmpty(),
        body('type').isIn(['support', 'ban_appeal']),
        body('subject').trim().notEmpty(),
        body('message').trim().notEmpty()
    ],
    handleValidationErrors,
    async (req, res) => {
        const { discordId, type, subject, message } = req.body;
        const client = await db.getPool().connect();

        try {
            await client.query('BEGIN');
            const { rows: [user] } = await client.query('SELECT id FROM users WHERE discord_id = $1', [discordId]);
            if (!user) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'No Blox Battles account is linked to this Discord user.' });
            }

            const { rows: [newTicket] } = await client.query(
                `INSERT INTO tickets (user_id, type, subject) VALUES ($1, $2, $3) RETURNING id`,
                [user.id, type, subject]
            );
            const ticketId = newTicket.id;

            await client.query(
                'INSERT INTO ticket_messages (ticket_id, author_id, message) VALUES ($1, $2, $3)',
                [ticketId, user.id, message]
            );

            const taskPayload = {
                ticket_id: ticketId,
                user_discord_id: discordId,
                ticket_type: type,
                subject: subject,
                description: message
            };
            await client.query("INSERT INTO tasks (task_type, payload) VALUES ('CREATE_TICKET_CHANNEL', $1)", [JSON.stringify(taskPayload)]);
            
            await client.query('COMMIT');
            res.status(201).json({ message: 'Support ticket created successfully! A private channel has been opened for you in our Discord server.' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Bot Create Ticket Error:", error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        } finally {
            client.release();
        }
    }
);

// [NEW] Secure endpoint for the bot to create generic tasks.
router.post('/tasks',
    authenticateBot,
    [
        body('task_type').isString().notEmpty(),
        body('payload').isObject()
    ],
    handleValidationErrors,
    async (req, res) => {
        const { task_type, payload } = req.body;
        try {
            await db.query('INSERT INTO tasks (task_type, payload) VALUES ($1, $2)', [task_type, payload]);
            res.status(201).json({ message: 'Task created successfully.' });
        } catch (err) {
            console.error("Bot Create Task Error:", err);
            res.status(500).json({ message: 'Failed to create task.' });
        }
    }
);


router.post('/initiate-link',
    authenticateBot,
    [
        body('username').trim().notEmpty().withMessage('Blox Battles username is required.'),
        body('discordId').isString().notEmpty().withMessage('Discord ID is required.'),
        body('discordUsername').isString().notEmpty().withMessage('Discord username is required.')
    ],
    handleValidationErrors,
    async (req, res) => {
        const { username, discordId, discordUsername } = req.body;
        const client = await db.getPool().connect();

        try {
            await client.query('BEGIN');
            const { rows: [user] } = await client.query("SELECT id, discord_id FROM users WHERE username ILIKE $1", [username]);
            if (!user) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: `No Blox Battles account found for username "${username}".` });
            }
            if (user.discord_id) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'This Blox Battles account is already linked to a Discord account.' });
            }
            const { rows: [existingDiscordLink] } = await client.query("SELECT id FROM users WHERE trim(discord_id) = trim($1)", [discordId]);
            if (existingDiscordLink) {
                await client.query('ROLLBACK');
                return res.status(409).json({ message: 'This Discord account is already linked to another Blox Battles account.' });
            }
            
            await client.query(
                `INSERT INTO inbox_messages (user_id, type, title, message, reference_id) VALUES ($1, 'discord_link_request', 'Discord Account Link Request', $2, $3)`,
                [user.id, discordUsername, discordId]
            );
            
            await client.query('COMMIT');
            sendInboxRefresh(user.id);
            res.status(200).json({ message: 'Link request sent to the user on the Blox Battles website.' });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Discord Initiate Link Error:", error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        } finally {
            client.release();
        }
    }
);

router.post('/respond-link',
    authenticateToken,
    [ body('messageId').isString().notEmpty(), body('response').isIn(['confirm', 'decline']) ],
    handleValidationErrors,
    async (req, res) => {
        const { messageId, response } = req.body;
        const userId = req.user.userId;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            const numericId = parseInt(messageId.replace('message-', ''), 10);
            const { rows: [message] } = await client.query("SELECT id, message, reference_id FROM inbox_messages WHERE id = $1 AND user_id = $2 AND type = 'discord_link_request'", [numericId, userId]);
            if (!message) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Link request not found or invalid.' });
            }
            if (response === 'confirm') {
                const discordUsername = message.message;
                const discordId = message.reference_id;
                const { rows: [existingLink] } = await client.query("SELECT id FROM users WHERE trim(discord_id) = trim($1)", [discordId]);
                if (existingLink) {
                    await client.query("DELETE FROM inbox_messages WHERE id = $1", [numericId]);
                    await client.query('COMMIT');
                    return res.status(409).json({ message: 'This Discord account has already been linked by another user.' });
                }
                await client.query("UPDATE users SET discord_id = $1, discord_username = $2 WHERE id = $3", [discordId, discordUsername, userId]);
                const taskPayload = { discordId: discordId };
                await client.query("INSERT INTO tasks (task_type, payload) VALUES ('SEND_DISCORD_LINK_SUCCESS_DM', $1)", [JSON.stringify(taskPayload)]);
            }
            await client.query("DELETE FROM inbox_messages WHERE id = $1", [numericId]);
            await client.query('COMMIT');
            res.status(200).json({ message: `Discord account link ${response}ed.` });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Discord Respond Link Error:", error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        } finally {
            client.release();
        }
    }
);

router.post('/unlink',
    authenticateBot,
    [ body('discordId').isString().notEmpty().withMessage('Discord ID is required.') ],
    handleValidationErrors,
    async (req, res) => {
        const { discordId } = req.body;
        try {
            const { rowCount } = await db.query("UPDATE users SET discord_id = NULL, discord_username = NULL WHERE trim(discord_id) = trim($1)", [discordId]);
            if (rowCount === 0) {
                return res.status(404).json({ message: "No Blox Battles account is linked to this Discord account." });
            }
            res.status(200).json({ message: "Account unlinked successfully." });
        } catch (error) {
            console.error("Discord Unlink Error:", error);
            res.status(500).json({ message: "An internal server error occurred." });
        }
    }
);

module.exports = router;
