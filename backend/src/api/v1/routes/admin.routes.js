// /backend/src/api/v1/routes/admin.routes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const AdminController = require('../../../controllers/admin.controller');
const { authenticateToken, isAdmin } = require('../../../middleware/auth');
const { handleValidationErrors } = require('../../../middleware/validator');

const router = express.Router();

// Protect all admin routes with authentication and admin role checks
router.use(authenticateToken, isAdmin);

router.get('/stats', AdminController.getStats);

router.get(
  '/users',
  [
    query('search').optional().isString().trim(),
    query('status').optional().isIn(['active', 'banned', 'terminated']),
  ],
  handleValidationErrors,
  AdminController.findUsers
);

router.post(
  '/users/:userId/ban',
  [
    param('userId').isUUID().withMessage('A valid user ID is required.'),
    body('reason').isString().notEmpty().withMessage('A ban reason is required.'),
    body('durationHours').optional({ nullable: true }).isInt({ gt: 0 }).withMessage('Duration must be a positive number of hours.'),
  ],
  handleValidationErrors,
  AdminController.banUser
);

router.post(
  '/users/:userId/unban',
  [
    param('userId').isUUID().withMessage('A valid user ID is required.'),
  ],
  handleValidationErrors,
  AdminController.unbanUser
);

router.post(
  '/users/:userId/gems',
  [
    param('userId').isUUID().withMessage('A valid user ID is required.'),
    body('amount').isInt().withMessage('Amount must be an integer.'),
  ],
  handleValidationErrors,
  AdminController.adjustGems
);

module.exports = router;
