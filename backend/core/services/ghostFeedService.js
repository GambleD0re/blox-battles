// backend/core/services/ghostFeedService.js
const fetch = require('node-fetch');
const { broadcast } = require('../../webSocketManager');
const db = require('../../database/database');

const GHOST_FEED_INTERVAL = 600000;
let ghostFeedTimer = null;

const WAGERS = [100, 250, 500, 1000, 2500];
const RIVALS_GAME_ID = 'rivals';

// More efficient search strategy
const SEARCH_KEYWORDS = ['Player', 'User', 'Gammer', 'Pro', 'Noob', 'King', 'Star', 'Cat', 'Dog', 'Wolf'];

async function getRandomRobloxUser() {
    const MAX_ATTEMPTS = 10;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        try {
            const keyword = SEARCH_KEYWORDS[Math.floor(Math.random() * SEARCH_KEYWORDS.length)];
            const searchUrl = `https://users.roblox.com/v1/users/search?keyword=${keyword}&limit=100`;
            
            const searchResponse = await fetch(searchUrl);
            if (!searchResponse.ok) continue;

            const searchData = await searchResponse.json();
            const potentialUsers = searchData.data.filter(u => !u.isBanned && u.name);
            if (potentialUsers.length === 0) continue;
            
            const randomUser = potentialUsers[Math.floor(Math.random() * potentialUsers.length)];
            const userId = randomUser.id;

            const thumbApiUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`;
            const thumbResponse = await fetch(thumbApiUrl);
            if (!thumbResponse.ok) continue;

            const thumbData = await thumbResponse.json();
            const avatarInfo = thumbData.data?.[0];

            if (avatarInfo && avatarInfo.state === 'Completed' && avatarInfo.imageUrl) {
                return {
                    username: randomUser.name,
                    avatarUrl: avatarInfo.imageUrl,
                    robloxId: userId
                };
            }
        } catch (error) {
            console.warn(`[GhostFeed] Attempt ${i + 1} failed: ${error.message}`);
        }
    }
    throw new Error(`Failed to find a valid random Roblox user after ${MAX_ATTEMPTS} attempts.`);
}


async function generateGhostDuel() {
    try {
        console.log('[GhostFeed] Attempting to generate a ghost duel...');
        const [player1, player2] = await Promise.all([getRandomRobloxUser(), getRandomRobloxUser()]);

        const winner = Math.random() < 0.5 ? player1 : player2;
        const loser = winner === player1 ? player2 : player1;
        
        const wager = WAGERS[Math.floor(Math.random() * WAGERS.length)];
        const pot = wager * 2 - Math.ceil(wager * 2 * 0.01);
        const loserScore = Math.floor(Math.random() * 5);
        const duelId = `ghost-${Date.now()}`;

        const duelPayload = {
            id: duelId,
            gameId: RIVALS_GAME_ID,
            winner: winner,
            loser: loser,
            score: { [winner.username]: 5, [loser.username]: loserScore },
            wager: wager,
            pot: pot,
        };

        broadcast({
            type: 'live_feed_update',
            payload: duelPayload
        });

        const discordTaskPayload = {
            duelId: duelId,
            gameId: RIVALS_GAME_ID,
            winner: { username: winner.username, robloxId: winner.robloxId, avatarUrl: winner.avatarUrl },
            loser: { username: loser.username, robloxId: loser.robloxId, avatarUrl: loser.avatarUrl },
            pot: pot,
            finalScores: { [winner.username]: 5, [loser.username]: loserScore }
        };

        await db.query("INSERT INTO tasks (task_type, payload) VALUES ('POST_DUEL_RESULT_TO_DISCORD', $1)", [JSON.stringify(discordTaskPayload)]);
        
        console.log(`[GhostFeed] Successfully broadcasted ghost duel for: ${winner.username} vs ${loser.username}`);

    } catch (error) {
        console.error('[GhostFeed] Failed to generate a complete ghost duel:', error.message);
    } finally {
        resetGhostFeedTimer();
    }
}

const resetGhostFeedTimer = () => {
    if (ghostFeedTimer) {
        clearTimeout(ghostFeedTimer);
    }
    ghostFeedTimer = setTimeout(generateGhostDuel, GHOST_FEED_INTERVAL);
};

const startGhostFeed = (wss) => {
    console.log('[GhostFeed] Service started. Initializing first timer.');
    resetGhostFeedTimer();
};

module.exports = {
    startGhostFeed,
    resetGhostFeedTimer,
};
