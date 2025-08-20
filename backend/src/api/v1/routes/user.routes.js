// /backend/src/api/v1/routes/user.routes.js
const express = require('express');
const UserController = require('../../../controllers/user.controller');
const GameController = require('../../../controllers/game.controller');
const { authenticateToken } = require('../../../middleware/auth');

const router = express.Router();

// All routes in this file are for the currently authenticated user
router.use(authenticateToken);

// Provides the main dashboard data for the authenticated user.
router.get(
  '/me',
  UserController.getMyProfile
);

// Provides the list of game accounts linked to the authenticated user.
router.get(
  '/me/identities',
  GameController.getMyGameIdentities
);

module.exports = router;
