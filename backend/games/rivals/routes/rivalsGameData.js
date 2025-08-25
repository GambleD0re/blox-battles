// backend/games/rivals/routes/rivalsGameData.js
const express = require('express');
const router = express.Router();
const GAME_DATA = require('../data/rivalsGameData.js');

router.get('/', (req, res) => {
    res.json(GAME_DATA);
});

module.exports = router;
