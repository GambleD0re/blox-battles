// backend/core/services/ghostFeedService.js
const fetch = require('node-fetch');
const { broadcast } = require('../../webSocketManager');
const db = require('../../database/database');

const GHOST_FEED_INTERVAL = 600000;
let ghostFeedTimer = null;

const WAGERS = [100, 250, 500, 1000, 2500];
const RIVALS_GAME_ID = 'rivals';

async function getRandomRobloxUser() {
    const MAX_ATTEMPTS = 10;
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const randomId = Math.floor(Math.random() * 3000000000) + 1;
        try {
            const userApiUrl = `https://users.roblox.com/v1/users/${randomId}`;
            const userResponse = await fetch(userApiUrl);
            if (!userResponse.ok) continue;

            const userData = await userResponse.json();
            if (userData.isBanned || !userData.name) continue;

            const thumbApiUrl = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${randomId}&size=150x150&format=Png&isCircular=false`;
            const thumbResponse = await fetch(thumbApiUrl);
            if (!thumbResponse.ok) continue;

            const thumbData = await thumbResponse.json();
            const avatarInfo = thumbData.data?.[0];

            if (avatarInfo && avatarInfo.state === 'Completed' && avatarInfo.imageUrl) {
                return {
                    username: userData.name,
                    avatarUrl: avatarInfo.imageUrl,
                    robloxId: randomId
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
