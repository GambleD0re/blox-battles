// backend/routes/index.js
const express = require('express');
const authRoutes = require('../core/routes/auth.js');
const userRoutes = require('../core/routes/users.js');
const paymentsRoutes = require('../core/routes/payments.js');
const payoutRoutes = require('../core/routes/payouts.js');
const configRoutes = require('../core/routes/config.js');
const adminRoutes = require('./admin.js');
const statusRoutes = require('./status.js');
const ticketRoutes = require('./tickets.js');
const transcriptRoutes = require('./transcripts.js');
const duelHistoryRoutes = require('./duelHistory.js'); // [NEW] Import the new route

// Game-specific routes for Rivals
const rivalsDuelRoutes = require('../games/rivals/routes/rivalsDuels.js');
const rivalsQueueRoutes = require('../games/rivals/routes/rivalsQueue.js');
const rivalsAdminRoutes = require('../games/rivals/routes/rivalsAdmin.js');
const rivalsProfileRoutes = require('../games/rivals/routes/rivalsProfile.js');
const rivalsGameDataRoutes = require('../games/rivals/routes/rivalsGameData.js');

const router = express.Router();

// Core, game-agnostic routes
router.use('/auth', authRoutes);
router.use('/payments', paymentsRoutes);
router.use('/payouts', payoutRoutes);
router.use('/config', configRoutes);
router.use('/admin', adminRoutes);
router.use('/status', statusRoutes);
router.use('/tickets', ticketRoutes);
router.use('/transcripts', transcriptRoutes);
router.use('/duel-history', duelHistoryRoutes); // [NEW] Mount the new global route

// This new route will serve the list of games for the main dashboard
router.get('/games', (req, res) => {
    db.query('SELECT id, name, description, icon_url FROM games WHERE is_active = TRUE')
      .then(result => res.json(result.rows))
      .catch(err => res.status(500).json({ message: 'Failed to fetch games.' }));
});

// Main user data route (must be below others to avoid conflicts)
router.use('/', userRoutes); 

// Game-specific routes, properly namespaced
router.use('/games/rivals/profile', rivalsProfileRoutes);
router.use('/games/rivals/gamedata', rivalsGameDataRoutes);
router.use('/games/rivals/duels', rivalsDuelRoutes);
router.use('/games/rivals/queue', rivalsQueueRoutes);
router.use('/games/rivals/admin', rivalsAdminRoutes);

module.exports = router;
