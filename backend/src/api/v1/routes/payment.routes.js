// /backend/src/api/v1/routes/payment.routes.js
const express = require('express');
const { body } = require('express-validator');
const PaymentController = require('../../../controllers/payment.controller');
const { authenticateToken } = require('../../../middleware/auth');
const { handleValidationErrors } = require('../../../middleware/validator');

const router = express.Router();

// --- User-Facing Payment Routes ---

router.post(
  '/stripe/checkout-session',
  authenticateToken,
  [
    body('amount').isFloat({ gt: 0 }).withMessage('A positive amount is required.'),
  ],
  handleValidationErrors,
  PaymentController.createStripeCheckoutSession
);

router.post(
  '/payouts/request-crypto',
  authenticateToken,
  [
    body('gemAmount').isInt({ gt: 0 }).withMessage('Gem amount must be a positive integer.'),
    body('recipientAddress').isEthereumAddress().withMessage('A valid recipient wallet address is required.'),
    body('tokenType').isIn(['USDC', 'USDT']).withMessage('A valid token type is required.'),
  ],
  handleValidationErrors,
  PaymentController.requestPayout
);


// --- Webhook Route (Handled separately in app.js) ---
// This file does not define the webhook route itself, as it requires
// special middleware that must be applied before the global JSON parser.

module.exports = router;
