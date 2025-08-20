// /backend/src/api/v1/routes/duel.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const DuelController = require('../../../controllers/duel.controller');
const { authenticateToken, authenticateBot } = require('../../../middleware/auth');
const { handleValidationErrors } = require('../../../middleware/validator');

const router = express.Router();

// --- User-Facing Routes (Require JWT) ---

router.post(
  '/challenge',
  authenticateToken,
  [
    body('opponentId').isUUID().withMessage('A valid opponent ID is required.'),
    body('gameId').isInt({ gt: 0 }).withMessage('A valid game ID is required.'),
    body('wager').isInt({ gt: 0 }).withMessage('Wager must be a positive number.'),
    body('matchParameters').isObject().withMessage('Match parameters must be a valid object.'),
  ],
  handleValidationErrors,
  DuelController.createChallenge
);

router.get(
    '/:id',
    authenticateToken,
    [
        param('id').isInt({ gt: 0 }).withMessage('A valid duel ID is required.'),
    ],
    handleValidationErrors,
    DuelController.getDuelById
);

router.post(
  '/queue/join',
  authenticateToken,
  [
    body('gameId').isInt({ gt: 0 }).withMessage('A valid game ID is required.'),
    body('wager').isInt({ gt: 0 }).withMessage('Wager must be a positive number.'),
    body('region').isString().notEmpty().withMessage('A region is required.'),
  ],
  handleValidationErrors,
  DuelController.joinQueue
);

router.post(
    '/queue/leave',
    authenticateToken,
    DuelController.leaveQueue
);


// --- Bot-Facing Routes (Require API Key) ---

router.post(
  '/servers/heartbeat',
  authenticateBot,
  [
    body('serverId').isString().notEmpty().withMessage('Server ID is required.'),
    body('region').isString().notEmpty().withMessage('Region is required.'),
    body('joinLink').isURL().withMessage('A valid join link URL is required.'),
  ],
  handleValidationErrors,
  DuelController.serverHeartbeat
);


module.exports = router;
