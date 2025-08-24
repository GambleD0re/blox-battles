// discord-bot/core/utils/gameData.js
const { apiClient } = require('./apiClient');

let gameDataCache = new Map();
let activeGames = [];

const cacheGameData = async (gameId) => {
    try {
        const response = await apiClient.get(`/games/${gameId}/gamedata`);
        gameDataCache.set(gameId, response.data);
        console.log(`[GameData] Successfully cached game data for: ${gameId}`);
    } catch (error) {
        console.error(`[GameData] Failed to cache game data for ${gameId}:`, error.response?.data?.message || error.message);
        throw new Error(`Could not initialize game data cache for ${gameId}.`);
    }
};

const cacheActiveGamesList = async () => {
    try {
        const { data } = await apiClient.get('/games');
        activeGames = data;
        console.log(`[GameData] Cached active games list: ${activeGames.map(g => g.name).join(', ')}`);
    } catch (error) {
         console.error(`[GameData] Failed to cache active games list:`, error.response?.data?.message || error.message);
    }
};

function getGameData(gameId) {
    return gameDataCache.get(gameId);
}

// [ADDED] New function to provide choices for slash commands
function getGameChoices() {
    return activeGames.map(game => ({ name: game.name, value: game.id }));
}

module.exports = {
    cacheGameData,
    getGameData,
    cacheActiveGamesList,
    getGameChoices,
};
