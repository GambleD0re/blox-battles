// backend/core/routes/reactionRoles.js
const express = require('express');
const { body, query, param } = require('express-validator');
const db = require('../../database/database');
const { authenticateBot, handleValidationErrors } = require('../../middleware/auth');

const router = express.Router();

router.post('/',
    authenticateBot,
    [
        body('messageId').isString().notEmpty(),
        body('emojiId').isString().notEmpty(),
        body('roleId').isString().notEmpty(),
    ],
    handleValidationErrors,
    async (req, res) => {
        const { messageId, emojiId, roleId } = req.body;
        try {
            await db.query(
                "INSERT INTO reaction_roles (message_id, emoji_id, role_id) VALUES ($1, $2, $3) ON CONFLICT (message_id, emoji_id) DO UPDATE SET role_id = $3",
                [messageId, emojiId, roleId]
            );
            res.status(201).json({ message: 'Reaction role rule created/updated successfully.' });
        } catch (error) {
            console.error('Create Reaction Role Error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.delete('/',
    authenticateBot,
    [
        body('messageId').isString().notEmpty(),
        body('emojiId').isString().notEmpty(),
    ],
    handleValidationErrors,
    async (req, res) => {
        const { messageId, emojiId } = req.body;
        try {
            const { rowCount } = await db.query(
                "DELETE FROM reaction_roles WHERE message_id = $1 AND emoji_id = $2",
                [messageId, emojiId]
            );
            if (rowCount === 0) {
                return res.status(404).json({ message: 'Reaction role rule not found.' });
            }
            res.status(200).json({ message: 'Reaction role rule deleted successfully.' });
        } catch (error) {
            console.error('Delete Reaction Role Error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.get('/lookup',
    authenticateBot,
    [
        query('messageId').isString().notEmpty(),
        query('emojiId').isString().notEmpty(),
    ],
    handleValidationErrors,
    async (req, res) => {
        const { messageId, emojiId } = req.query;
        try {
            const { rows: [rule] } = await db.query(
                "SELECT role_id FROM reaction_roles WHERE message_id = $1 AND emoji_id = $2",
                [messageId, emojiId]
            );
            if (!rule) {
                return res.status(404).json({ message: 'No rule found for this reaction.' });
            }
            res.status(200).json({ roleId: rule.role_id });
        } catch (error) {
            console.error('Lookup Reaction Role Error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.get('/bymessage/:messageId',
    authenticateBot,
    [ param('messageId').isString().notEmpty() ],
    handleValidationErrors,
    async (req, res) => {
        const { messageId } = req.params;
        try {
            const { rows } = await db.query(
                "SELECT emoji_id, role_id FROM reaction_roles WHERE message_id = $1",
                [messageId]
            );
            res.status(200).json(rows);
        } catch (error) {
            console.error('List Reaction Roles Error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

module.exports = router;
