// discord-bot/utils/statusUpdater.js
const { apiClient } = require('./apiClient');

const { MEMBERS_VC_ID, PLAYERS_VC_ID } = process.env;
const STATS_UPDATE_INTERVAL_MS = 10 * 60 * 1000;

async function updateStatChannels(client) {
    if (!MEMBERS_VC_ID && !PLAYERS_VC_ID) return;
    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        if (MEMBERS_VC_ID) {
            await guild.members.fetch();
            const memberCount = guild.memberCount;
            const memberChannel = await client.channels.fetch(MEMBERS_VC_ID).catch(() => null);
            if (memberChannel) await memberChannel.setName(`📈 Members: ${memberCount.toLocaleString()}`).catch(console.warn);
        }

        if (PLAYERS_VC_ID) {
            const response = await apiClient.get('/status/player-count');
            const playerCount = response.data.playerCount || 0;
            const playerChannel = await client.channels.fetch(PLAYERS_VC_ID).catch(() => null);
            if (playerChannel) await playerChannel.setName(`💻 Players: ${playerCount.toLocaleString()}`).catch(console.warn);
        }
    } catch (err) {
        console.error(`[Status] Failed to update stat channels: ${err.message}`);
    }
}

function startStatusUpdaters(client) {
    console.log(`[Status] Status updaters started.`);
    updateStatChannels(client);
    setInterval(() => updateStatChannels(client), STATS_UPDATE_INTERVAL_MS);
}

module.exports = { startStatusUpdaters };
