// discord-bot/core/events/ready.js
const { Events } = require('discord.js');
const { apiClient } = require('../utils/apiClient');
const { cacheGameData, cacheActiveGamesList } = require('../utils/gameData');
const { startTaskProcessor } = require('../tasks/taskProcessor');
const { startStatusUpdaters } = require('../utils/statusUpdater');
const { cacheStatuses } = require('../utils/statusCache'); // [ADDED]

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Bot logged in as ${client.user.tag}!`);
        try {
            await cacheActiveGamesList(); 
            const { data: activeGames } = await apiClient.get('/games');
            
            for (const game of activeGames) {
                await cacheGameData(game.id);
            }

            await cacheStatuses(); // [ADDED] Cache command & ticket statuses on startup

            startTaskProcessor(client);
            startStatusUpdaters(client);
            console.log("Bot initialization complete. Systems are running.");
        } catch (error) {
            console.error("A critical error occurred during bot initialization:", error);
        }
    },
};
