// backend/core/services/serverStatusMonitor.js
const db = require('../../database/database');
const rivalsGameData = require('../../games/rivals/data/rivalsGameData');

const CHECK_INTERVAL_MS = 30 * 1000;
const RIVALS_GAME_ID = 'rivals';

const regionStatus = new Map();
let isInitialRun = true;

async function checkServerStatuses() {
    try {
        const { rows: activeServers } = await db.query(
            `SELECT DISTINCT region FROM game_servers WHERE game_id = $1 AND last_heartbeat >= NOW() - INTERVAL '60 seconds'`,
            [RIVALS_GAME_ID]
        );
        const activeRegions = new Set(activeServers.map(s => s.region));

        for (const region of rivalsGameData.regions) {
            const regionId = region.id;
            const previousStatus = regionStatus.get(regionId) || 'offline';
            const currentStatus = activeRegions.has(regionId) ? 'online' : 'offline';

            if (isInitialRun || previousStatus !== currentStatus) {
                const logMessage = isInitialRun
                    ? `[StatusMonitor] Initial state for ${regionId} is ${currentStatus}. Creating task.`
                    : `[StatusMonitor] Region ${regionId} changed status from ${previousStatus} to ${currentStatus}. Creating task.`;
                console.log(logMessage);

                const taskPayload = {
                    gameId: RIVALS_GAME_ID,
                    region: regionId,
                    status: currentStatus,
                };

                await db.query(
                    "INSERT INTO tasks (task_type, payload) VALUES ('ANNOUNCE_SERVER_STATUS', $1)",
                    [JSON.stringify(taskPayload)]
                );
                
                regionStatus.set(regionId, currentStatus);
            }
        }
        isInitialRun = false;
    } catch (error) {
        console.error('[StatusMonitor] Error checking server statuses:', error);
    }
}

function startServerStatusMonitor() {
    console.log(`[StatusMonitor] Service started. Checking every ${CHECK_INTERVAL_MS / 1000} seconds.`);
    checkServerStatuses();
    setInterval(checkServerStatuses, CHECK_INTERVAL_MS);
}

module.exports = { startServerStatusMonitor };
