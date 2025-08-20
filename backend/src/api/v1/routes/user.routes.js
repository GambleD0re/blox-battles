// /backend/src/api/v1/routes/user.routes.js
const express = require('express');
const UserController = require('../../../controllers/user.controller');
const { authenticateToken } = require('../../../middleware/auth');
const { handleValidationErrors } = require('../../../middleware/validator');

const router = express.Router();

// This route provides the main dashboard data for the authenticated user.
router.get(
  '/me',
  authenticateToken,
  UserController.getMyProfile
);

module.exports = router;
