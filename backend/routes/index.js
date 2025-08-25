// backend/routes/index.js
const express = require('express');
const db = require('../database/database');
const authRoutes = require('../core/routes/auth.js');
const userRoutes = require('../core/routes/users.js');
const paymentsRoutes = require('../core/routes/payments.js');
const payoutRoutes = require('../core/routes/payouts.js');
const configRoutes = require('../core/routes/config.js');
const inboxRoutes = require('../core/routes/inbox.js');
const discordRoutes = require('../core/routes/discord.js');
const reactionRolesRoutes = require('../core/routes/reactionRoles.js');
const adminRoutes = require('./admin.js');
const statusRoutes = require('./status.js');
const ticketRoutes = require('./tickets.js');
const transcriptRoutes = require('./transcripts.js');
const duelHistoryRoutes = require('./duelHistory.js');
const taskRoutes = require('./tasks.js');
const logRoutes = require('./log.js');

// Game-specific routes for Rivals
const rivalsDuelRoutes = require('../games/rivals/routes/rivalsDuels.js');
const rivalsQueueRoutes = require('../games/rivals/routes/rivalsQueue.js');
const rivalsAdminRoutes = require('../games/rivals/routes/rivalsAdmin.js');
const rivalsProfileRoutes = require('../games/rivals/routes/rivalsProfile.js');
const rivalsGameDataRoutes = require('../games/rivals/routes/rivalsGameData.js');
const rivalsLeaderboardRoutes = require('../games/rivals/routes/rivalsLeaderboard.js');

const router = express.Router();

// Core, game-agnostic routes
router.use('/auth', authRoutes);
router.use('/payments', paymentsRoutes);
router.use('/payouts', payoutRoutes);
router.use('/config', configRoutes);
router.use('/inbox', inboxRoutes);
router.use('/discord', discordRoutes);
router.use('/reaction-roles', reactionRolesRoutes);
router.use('/admin', adminRoutes);
router.use('/status', statusRoutes);
router.use('/tickets', ticketRoutes);
router.use('/transcripts', transcriptRoutes);
router.use('/duel-history', duelHistoryRoutes);
router.use('/tasks', taskRoutes);
router.use('/log', logRoutes);

router.get('/games', async (req, res) => {
    try {
        const { rows } = await db.query('SELECT id, name, description, icon_url FROM games WHERE is_active = TRUE');
        res.status(200).json(rows);
    } catch (err) {
        console.error("Fetch Games Error:", err);
        res.status(500).json({ message: 'Failed to fetch games.' });
    }
});

// Main user data route (must be below others to avoid conflicts)
router.use('/', userRoutes); 

// Game-specific routes, properly namespaced
router.use('/games/rivals/profile', rivalsProfileRoutes);
router.use('/games/rivals/gamedata', rivalsGameDataRoutes);
router.use('/games/rivals/duels', rivalsDuelRoutes);
router.use('/games/rivals/queue', rivalsQueueRoutes);
router.use('/games/rivals/admin', rivalsAdminRoutes);
router.use('/games/rivals/leaderboard', rivalsLeaderboardRoutes);

module.exports = router;
