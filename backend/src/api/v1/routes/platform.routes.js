// /backend/src/api/v1/routes/platform.routes.js
const express = require('express');
const { body, param } = require('express-validator');
const PlatformController = require('../../../controllers/platform.controller');
const { authenticateToken } = require('../../../middleware/auth');
const { handleValidationErrors } = require('../../../middleware/validator');

const router = express.Router();

// All routes in this file require an authenticated user session.
router.use(authenticateToken);

// Initiates the linking process for a given platform.
// For Roblox, this would generate and return a unique verification phrase.
router.post(
  '/:platformId/link',
  [
    param('platformId').isInt({ gt: 0 }).withMessage('A valid platform ID is required.'),
  ],
  handleValidationErrors,
  PlatformController.initiateLink
);

// Verifies and finalizes the account link.
// For Roblox, this would take a username and check their bio for the phrase.
router.post(
  '/:platformId/verify',
  [
    param('platformId').isInt({ gt: 0 }).withMessage('A valid platform ID is required.'),
    body('identity').isString().notEmpty().withMessage('The platform identifier (e.g., username) is required.'),
  ],
  handleValidationErrors,
  PlatformController.confirmLink
);

module.exports = router;
