// /backend/src/api/v1/index.js
const express = require('express');
// Import future routers here as they are created
// const authRoutes = require('./routes/auth.routes');
// const userRoutes = require('./routes/user.routes');

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

// Mount future feature-specific routers here
// router.use('/auth', authRoutes);
// router.use('/users', userRoutes);


module.exports = router;
