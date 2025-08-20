// /backend/src/api/v1/index.js
const express = require('express');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const gameRoutes = require('./routes/game.routes');
const platformRoutes = require('./routes/platform.routes');
const duelRoutes = require('./routes/duel.routes');

const router = express.Router();

// --- API v1 Routes ---

// Default v1 route for status check
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    message: 'CyberDome API v1 is active.'
  });
});

// Mount feature-specific routers
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/games', gameRoutes);
router.use('/platforms', platformRoutes);
router.use('/duels', duelRoutes);


module.exports = router;
