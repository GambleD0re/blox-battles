// /backend/cron-tasks.js
require('dotenv').config();
const logger = require('./src/utils/logger');
const MatchmakingService = require('./src/services/matchmaking.service');
const { pool } = require('./src/config/database');

async function runScheduledTasks() {
  const startTime = Date.now();
  logger.info('--- [CRON] Starting scheduled task run ---');

  try {
    // --- Matchmaking Task ---
    // Finds waiting players in the queue and creates matches.
    await MatchmakingService.findAndProcessMatches();

    // --- Expired Duel Task (Future Implementation) ---
    // Finds duels in 'pending' or 'accepted' state that are too old and cancels them.
    // await DuelService.expireOldDuels();

    // --- Stale Server Cleanup Task (Future Implementation) ---
    // Finds game servers that haven't sent a heartbeat and removes them.
    // await ServerService.pruneStaleServers();

  } catch (error) {
    logger.error({ err: error }, '[CRON] A critical error occurred during the task run.');
  } finally {
    const duration = Date.now() - startTime;
    logger.info(`--- [CRON] Scheduled task run finished in ${duration}ms ---`);
    // Ensure the connection pool is closed to allow the script to exit gracefully.
    await pool.end();
  }
}

runScheduledTasks();
