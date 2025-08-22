// discord-bot/utils/gameData.js
const { apiClient } = require('./apiClient');

const gameDataCache = new Map();

async function cacheGameData(gameId) {
    try {
        const response = await apiClient.get(`/games/${gameId}/gamedata`);
        gameDataCache.set(gameId, response.data);
        console.log(`[GameData] Cached data for game: ${gameId}`);
    } catch (error) {
        console.error(`[GameData] Failed to cache data for ${gameId}:`, error.response?.data?.message || error.message);
        throw new Error(`Could not initialize game data cache for ${gameId}.`);
    }
}

function getGameData(gameId) {
    return gameDataCache.get(gameId) || { maps: [], weapons: [], regions: [] };
}

module.exports = {
    cacheGameData,
    getGameData,
};
