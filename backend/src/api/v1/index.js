// /backend/src/api/v1/index.js
//
// PURPOSE: This is the V1 router.
// Its job is to aggregate all the feature-specific routers (auth, users, duels, etc.)
// and mount them to their respective paths.

const express = require('express');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const gameRoutes = require('./routes/game.routes');
const platformRoutes = require('./routes/platform.routes');
const duelRoutes = require('./routes/duel.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');

const router = express.Router();

// --- API v1 Routes ---

// Default v1 route for a simple status check
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    version: '1.0.0',
    message: 'Blox Battles API v1 is active.'
  });
});

// Mount all feature-specific routers
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/games', gameRoutes);
router.use('/platforms', platformRoutes);
router.use('/duels', duelRoutes);
router.use('/payments', paymentRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
