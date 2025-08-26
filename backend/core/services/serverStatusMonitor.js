// backend/core/services/serverStatusMonitor.js
const db = require('../../database/database');
const rivalsGameData = require('../../games/rivals/data/rivalsGameData');

const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds
const RIVALS_GAME_ID = 'rivals';

// In-memory state to track the last known status of each region
const regionStatus = new Map();

async function checkServerStatuses() {
    try {
        // 1. Get all currently active regions from the database
        const { rows: activeServers } = await db.query(
            `SELECT DISTINCT region FROM game_servers WHERE game_id = $1 AND last_heartbeat >= NOW() - INTERVAL '60 seconds'`,
            [RIVALS_GAME_ID]
        );
        const activeRegions = new Set(activeServers.map(s => s.region));

        // 2. Iterate through all possible regions to check for status changes
        for (const region of rivalsGameData.regions) {
            const regionId = region.id;
            const previousStatus = regionStatus.get(regionId) || 'offline';
            const currentStatus = activeRegions.has(regionId) ? 'online' : 'offline';

            // 3. If the status has changed, create a task and update the state
            if (previousStatus !== currentStatus) {
                console.log(`[StatusMonitor] Region ${regionId} changed status from ${previousStatus} to ${currentStatus}. Creating task.`);

                const taskPayload = {
                    gameId: RIVALS_GAME_ID,
                    region: regionId,
                    status: currentStatus
                };

                await db.query(
                    "INSERT INTO tasks (task_type, payload) VALUES ('ANNOUNCE_SERVER_STATUS', $1)",
                    [JSON.stringify(taskPayload)]
                );
                
                regionStatus.set(regionId, currentStatus);
            }
        }
    } catch (error) {
        console.error('[StatusMonitor] Error checking server statuses:', error);
    }
}

function startServerStatusMonitor() {
    console.log(`[StatusMonitor] Service started. Checking every ${CHECK_INTERVAL_MS / 1000} seconds.`);
    // Run once on startup, then set the interval
    checkServerStatuses();
    setInterval(checkServerStatuses, CHECK_INTERVAL_MS);
}

module.exports = { startServerStatusMonitor };
