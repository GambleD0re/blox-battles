// backend/routes/ticketTypes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const db = require('../database/database');
const { isAdmin, handleValidationErrors } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { deletable } = req.query;
        let sql = 'SELECT name, category_id, is_deletable FROM ticket_types';
        const params = [];

        if (deletable === 'true') {
            sql += ' WHERE is_deletable = TRUE';
        }
        
        sql += ' ORDER BY created_at ASC';

        const { rows } = await db.query(sql, params);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Fetch Ticket Types Error:', error);
        res.status(500).json({ message: 'Failed to fetch ticket types.' });
    }
});

router.post('/', isAdmin, 
    [
        body('name').trim().isLength({ min: 3, max: 50 }).withMessage('Ticket type name must be between 3 and 50 characters.'),
        body('categoryId').isString().isLength({ min: 18, max: 20 }).withMessage('A valid Discord Category ID is required.')
    ],
    handleValidationErrors,
    async (req, res) => {
        const { name, categoryId } = req.body;
        try {
            await db.query(
                'INSERT INTO ticket_types (name, category_id, is_deletable) VALUES ($1, $2, TRUE)',
                [name, categoryId]
            );
            res.status(201).json({ message: `Ticket type "${name}" created successfully.` });
        } catch (error) {
            if (error.code === '23505') { // unique_violation
                return res.status(409).json({ message: 'A ticket type with this name already exists.' });
            }
            console.error('Create Ticket Type Error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.delete('/:name', isAdmin, 
    [ param('name').trim().notEmpty() ],
    handleValidationErrors,
    async (req, res) => {
        const { name } = req.params;
        const client = await db.getPool().connect();
        try {
            await client.query('BEGIN');
            const { rows: [ticketType] } = await client.query(
                'SELECT is_deletable FROM ticket_types WHERE name = $1 FOR UPDATE',
                [name]
            );

            if (!ticketType) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Ticket type not found.' });
            }

            if (!ticketType.is_deletable) {
                await client.query('ROLLBACK');
                return res.status(403).json({ message: 'This is a core ticket type and cannot be deleted.' });
            }

            await client.query('DELETE FROM ticket_types WHERE name = $1', [name]);
            await client.query('COMMIT');
            res.status(200).json({ message: `Ticket type "${name}" has been deleted.` });
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Delete Ticket Type Error:', error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        } finally {
            client.release();
        }
    }
);

module.exports = router;
