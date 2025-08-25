// backend/core/routes/payouts.js
const express = require('express');
const { body, param } = require('express-validator');
const db = require('../../database/database');
const { authenticateToken, handleValidationErrors } = require('../../middleware/auth');
const crypto = require('crypto');
const { sendCryptoPayout } = require('../services/cryptoPayoutService');

const router = express.Router();

const GEM_TO_USD_CONVERSION_RATE = parseInt(process.env.GEM_TO_USD_CONVERSION_RATE || '110', 10);
const MINIMUM_GEM_WITHDRAWAL = parseInt(process.env.MINIMUM_GEM_WITHDRAWAL || '11', 10);

router.post('/request-crypto',
    authenticateToken,
    [
        body('gemAmount').isInt({ gt: MINIMUM_GEM_WITHDRAWAL - 1 }).withMessage(`Minimum withdrawal is ${MINIMUM_GEM_WITHDRAWAL} gems.`),
        body('recipientAddress').isEthereumAddress().withMessage('A valid recipient wallet address is required.'),
        body('tokenType').isIn(['USDC', 'USDT']).withMessage('A valid token type (USDC or USDT) is required.')
    ],
    handleValidationErrors,
    async (req, res) => {
        const { gemAmount, recipientAddress, tokenType } = req.body;
        const userId = req.user.userId;
        const client = await db.getPool().connect();

        try {
            await client.query('BEGIN');
            const { rows: [user] } = await client.query('SELECT id, gems FROM users WHERE id = $1 FOR UPDATE', [userId]);

            if (!user) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'User not found.' });
            }
            if (parseInt(user.gems) < gemAmount) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'Insufficient gem balance.' });
            }

            const amountUsd = gemAmount / GEM_TO_USD_CONVERSION_RATE;
            const payoutRequestId = crypto.randomUUID();

            await client.query('UPDATE users SET gems = gems - $1 WHERE id = $2', [gemAmount, userId]);
            
            await client.query(
                `INSERT INTO payout_requests (id, user_id, type, provider, amount_gems, amount_usd, fee_usd, destination_address, token_type, status)
                 VALUES ($1, $2, 'crypto', 'direct_node', $3, $4, 0, $5, $6, 'awaiting_approval')`,
                [payoutRequestId, userId, gemAmount, amountUsd, recipientAddress, tokenType]
            );

            await client.query('COMMIT');
            res.status(200).json({ message: 'Withdrawal request submitted! It is now pending admin review.' });

        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Crypto Withdrawal Request Error:", error);
            res.status(500).json({ message: 'An internal server error occurred while processing your crypto withdrawal.' });
        } finally {
            client.release();
        }
    }
);

router.post('/cancel-request/:id', authenticateToken, async (req, res) => {
    const requestId = req.params.id;
    const userId = req.user.userId;
    const client = await db.getPool().connect();

    try {
        await client.query('BEGIN');
        const { rows: [request] } = await client.query(
            "SELECT * FROM payout_requests WHERE id = $1 AND user_id = $2 AND status = 'awaiting_approval' FOR UPDATE",
            [requestId, userId]
        );

        if (!request) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Pending withdrawal request not found or cannot be canceled.' });
        }

        await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [request.amount_gems, userId]);
        await client.query("UPDATE payout_requests SET status = 'canceled_by_user' WHERE id = $1", [requestId]);

        await client.query('COMMIT');
        res.status(200).json({ message: 'Withdrawal request canceled and gems refunded.' });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Cancel Withdrawal Error:", error);
        res.status(500).json({ message: 'An internal server error occurred.' });
    } finally {
        client.release();
    }
});


router.put('/update-request/:id', authenticateToken,
    [
        body('recipientAddress').optional().isEthereumAddress().withMessage('A valid recipient wallet address is required.'),
        body('tokenType').optional().isIn(['USDC', 'USDT']).withMessage('A valid token type (USDC or USDT) is required.')
    ],
    handleValidationErrors,
    async (req, res) => {
        const requestId = req.params.id;
        const userId = req.user.userId;
        const { recipientAddress, tokenType } = req.body;

        try {
            const { rows: [request] } = await db.query(
                "SELECT * FROM payout_requests WHERE id = $1 AND user_id = $2 AND status = 'awaiting_approval'",
                [requestId, userId]
            );

            if (!request) {
                return res.status(404).json({ message: 'A withdrawal request awaiting approval was not found or it cannot be modified at this time.' });
            }
            if (!recipientAddress && !tokenType) {
                return res.status(400).json({ message: 'No new details provided for update.' });
            }
            
            const newAddress = recipientAddress || request.destination_address;
            const newTokenType = tokenType || request.tokenType;
            
            await db.query(
                "UPDATE payout_requests SET destination_address = $1, token_type = $2 WHERE id = $3",
                [newAddress, newTokenType, requestId]
            );

            res.status(200).json({ message: 'Withdrawal details updated successfully.' });

        } catch (error) {
            console.error("Update Withdrawal Details Error:", error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        }
    }
);

router.post('/:id/confirm-and-send',
    authenticateToken,
    param('id').isUUID(),
    handleValidationErrors,
    async (req, res) => {
        const requestId = req.params.id;
        const userId = req.user.userId;
        const client = await db.getPool().connect();

        try {
            await client.query('BEGIN');
            const { rows: [request] } = await client.query(
                "SELECT * FROM payout_requests WHERE id = $1 AND user_id = $2 AND status = 'approved' FOR UPDATE",
                [requestId, userId]
            );

            if (!request) {
                await client.query('ROLLBACK');
                return res.status(404).json({ message: 'Approved withdrawal request not found or you are not the owner.' });
            }

            await client.query("UPDATE payout_requests SET status = 'processing', updated_at = NOW() WHERE id = $1", [requestId]);
            
            try {
                const txHash = await sendCryptoPayout(request.destination_address, request.amount_usd, request.token_type);
                
                await client.query(
                    "UPDATE payout_requests SET status = 'completed', provider_payout_id = $1, updated_at = NOW() WHERE id = $2",
                    [txHash, requestId]
                );

                await client.query('COMMIT');
                res.status(200).json({ message: 'Withdrawal confirmed and is now being processed. You will receive the funds shortly.' });

            } catch (payoutError) {
                console.error(`[Payout Execution] Failed for request ${requestId}:`, payoutError);
                
                await client.query("UPDATE payout_requests SET status = 'failed', updated_at = NOW() WHERE id = $1", [requestId]);
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [request.amount_gems, userId]);
                
                await client.query(
                    `INSERT INTO inbox_messages (user_id, type, title, message, reference_id) VALUES ($1, 'withdrawal_failed', 'Withdrawal Failed', 'Your request to withdraw ' || $2 || ' gems failed during processing. The gems have been refunded to your account.', $3)`,
                    [userId, request.amount_gems, requestId]
                );

                await client.query('COMMIT');
                return res.status(500).json({ message: 'Failed to process the payout. Your gems have been refunded.' });
            }
        } catch (error) {
            await client.query('ROLLBACK');
            console.error("Confirm Withdrawal Error:", error);
            res.status(500).json({ message: 'An internal server error occurred.' });
        } finally {
            client.release();
        }
    }
);

module.exports = router;
