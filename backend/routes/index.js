// backend/routes/index.js
const express = require('express');
const db = require('../database/database');
const authRoutes = require('../core/routes/auth.js');
const userRoutes = require('../core/routes/users.js');
const paymentsRoutes = require('../core/routes/payments.js');
const payoutRoutes = require('../core/routes/payouts.js');
const configRoutes = require('../core/routes/config.js');
const inboxRoutes = require('../core/routes/inbox.js'); // [NEW] Import inbox route
const adminRoutes = require('./admin.js');
const statusRoutes = require('./status.js');
const ticketRoutes = require('./tickets.js');
const transcriptRoutes = require('./transcripts.js');
const duelHistoryRoutes = require('./duelHistory.js');

// Game-specific routes
const rivalsDuelRoutes = require('../games/rivals/routes/rivalsDuels.js');
const rivalsQueueRoutes = require('../games/rivals/routes/rivalsQueue.js');
const rivalsAdminRoutes = require('../games/rivals/routes/rivalsAdmin.js');
const rivalsProfileRoutes = require('../games/rivals/routes/rivalsProfile.js');
const rivalsGameDataRoutes = require('../games/rivals/routes/rivalsGameData.js');

const router = express.Router();

// Core routes
router.use('/auth', authRoutes);
router.use('/payments', paymentsRoutes);
router.use('/payouts', payoutRoutes);
router.use('/config', configRoutes);
router.use('/inbox', inboxRoutes); // [NEW] Mount inbox route
router.use('/admin', adminRoutes);
router.use('/status', statusRoutes);
router.use('/tickets', ticketRoutes);
router.use('/transcripts', transcriptRoutes);
router.use('/duel-history', duelHistoryRoutes);
router.get('/games', (req, res) => { /* ... unchanged ... */ });
router.use('/', userRoutes); 

// Game-specific routes
router.use('/games/rivals/profile', rivalsProfileRoutes);
router.use('/games/rivals/gamedata', rivalsGameDataRoutes);
router.use('/games/rivals/duels', rivalsDuelRoutes);
router.use('/games/rivals/queue', rivalsQueueRoutes);
router.use('/games/rivals/admin', rivalsAdminRoutes);

module.exports = router;
