// discord-bot/core/events/ready.js
const { Events } = require('discord.js');
const { apiClient } = require('../utils/apiClient');
const { cacheGameData, cacheActiveGamesList } = require('../utils/gameData');
const { startTaskProcessor } = require('../tasks/taskProcessor');
const { startStatusUpdaters } = require('../utils/statusUpdater');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Bot logged in as ${client.user.tag}!`);
        try {
            // [MODIFIED] Fetch the list of games first
            await cacheActiveGamesList(); 
            const { data: activeGames } = await apiClient.get('/games');
            
            // Then cache the specific data for each game
            for (const game of activeGames) {
                await cacheGameData(game.id);
            }

            startTaskProcessor(client);
            startStatusUpdaters(client);
            console.log("Bot initialization complete. Systems are running.");
        } catch (error) {
            console.error("A critical error occurred during bot initialization:", error);
        }
    },
};
