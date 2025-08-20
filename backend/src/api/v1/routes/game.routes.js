// /backend/src/api/v1/routes/game.routes.js
const express = require('express');
const GameController = require('../../../controllers/game.controller');

const router = express.Router();

// This is a public route to allow clients (frontend, bots)
// to discover what games are available on the platform.
router.get(
  '/',
  GameController.getAllActiveGames
);

module.exports = router;
