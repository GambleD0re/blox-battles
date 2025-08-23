// backend/services/matchmakingService.js
const db = require('../database/database');
const rivalsGameData = require('../games/rivals/data/rivalsGameData');
const { sendToUser } = require('../webSocketManager');
const { sendInboxRefresh } = require('../core/services/notificationService');

const MATCHMAKING_INTERVAL_SECONDS = parseInt(process.env.MATCHMAKING_INTERVAL_SECONDS || '5', 10);
const TAX_RATE_RANDOM = parseFloat(process.env.TAX_RATE_RANDOM || '0.01');
const RIVALS_GAME_ID = 'rivals';

const findAndProcessMatches = async () => {
    const pool = db.getPool();
    const { rows: waitingPlayers } = await pool.query('SELECT * FROM random_queue_entries ORDER BY created_at ASC');
    if (waitingPlayers.length < 2) return;

    const groupedByQueue = waitingPlayers.rows.reduce((acc, player) => {
        const key = `${player.game_id}_${player.region}_${player.wager}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(player);
        return acc;
    }, {});

    for (const key in groupedByQueue) {
        const players = groupedByQueue[key];
        while (players.length >= 2) {
            const p1 = players.shift();
            const p2 = players.shift();
            
            const client = await pool.connect();
            try {
                const { rows: [server] } = await client.query(`SELECT server_id, join_link FROM game_servers WHERE game_id = $1 AND region = $2 AND player_count < 40 AND last_heartbeat >= NOW() - INTERVAL '60 seconds' ORDER BY player_count ASC LIMIT 1 FOR UPDATE`, [p1.game_id, p1.region]);
                
                if (!server) {
                    players.unshift(p2, p1);
                    break; 
                }

                await client.query('BEGIN');
                
                const { rows: [p1Data] } = await client.query('SELECT gems FROM users WHERE id = $1 FOR UPDATE', [p1.user_id]);
                const { rows: [p2Data] } = await client.query('SELECT gems FROM users WHERE id = $1 FOR UPDATE', [p2.user_id]);

                if (parseInt(p1Data.gems) < parseInt(p1.wager) || parseInt(p2Data.gems) < parseInt(p2.wager)) {
                    await client.query('ROLLBACK');
                    continue;
                }
                
                await client.query('UPDATE users SET gems = gems - $1 WHERE id = $2', [p1.wager, p1.user_id]);
                await client.query('UPDATE users SET gems = gems - $1 WHERE id = $2', [p2.wager, p2.user_id]);
                await client.query('DELETE FROM random_queue_entries WHERE user_id = ANY($1::uuid[])', [[p1.user_id, p2.user_id]]);
                
                // --- Game-Specific Logic (Rivals) ---
                const p1Prefs = p1.game_specific_preferences;
                const p2Prefs = p2.game_specific_preferences;
                const combinedBans = [...new Set([...(p1Prefs.banned_weapons || []), ...(p2Prefs.banned_weapons || [])])];
                const availableMaps = rivalsGameData.maps.filter(m => m.id !== p1Prefs.banned_map && m.id !== p2Prefs.banned_map);
                const selectedMap = availableMaps.length > 0 ? availableMaps[Math.floor(Math.random() * availableMaps.length)] : rivalsGameData.maps[0];
                const rules = { map: selectedMap.id, banned_weapons: combinedBans, region: p1.region };
                // --- End Game-Specific Logic ---
                
                const totalPot = parseInt(p1.wager) * 2;
                const taxCollected = Math.ceil(totalPot * TAX_RATE_RANDOM);
                const finalPot = totalPot - taxCollected;
                const expirationOffset = Math.floor(Math.random() * 61) - 30;

                const { rows: [newDuel] } = await client.query(
                    `INSERT INTO duels (game_id, challenger_id, opponent_id, wager, pot, tax_collected, game_specific_rules, status, accepted_at, started_at, assigned_server_id, server_invite_link, expiration_offset_seconds)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, 'started', NOW(), NOW(), $8, $9, $10) RETURNING id, started_at`,
                    [p1.game_id, p1.user_id, p2.user_id, p1.wager, finalPot, taxCollected, JSON.stringify(rules), server.server_id, server.join_link, expirationOffset]
                );
                
                await client.query('UPDATE game_servers SET player_count = player_count + 2 WHERE server_id = $1', [server.server_id]);

                const { rows: [p1Info] } = await client.query('SELECT linked_game_username, avatar_url FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [p1.user_id, p1.game_id]);
                const { rows: [p2Info] } = await client.query('SELECT linked_game_username, avatar_url FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [p2.user_id, p2.game_id]);
                
                const taskPayload = { websiteDuelId: newDuel.id, serverId: server.server_id, serverLink: server.join_link, challenger: p1Info.linked_game_username, opponent: p2Info.linked_game_username, map: selectedMap.name, bannedWeapons: combinedBans.map(id => rivalsGameData.weapons.find(w => w.id === id)?.name || id), wager: p1.wager, gameId: p1.game_id };
                await client.query("INSERT INTO tasks (task_type, payload) VALUES ('REFEREE_DUEL', $1)", [JSON.stringify(taskPayload)]);
                
                await client.query('COMMIT');
                
                const basePayload = { duelId: newDuel.id, serverLink: server.join_link, startedAt: newDuel.started_at, bannedMap: rivalsGameData.maps.find(m => m.id === p1Prefs.banned_map || m.id === p2Prefs.banned_map)?.name, bannedWeapons: combinedBans.map(id => rivalsGameData.weapons.find(w => w.id === id)?.name || id) };
                sendToUser(p1.user_id, { type: 'match_found', payload: { ...basePayload, opponent: { username: p2Info.linked_game_username, avatarUrl: p2Info.avatar_url } }});
                sendToUser(p2.user_id, { type: 'match_found', payload: { ...basePayload, opponent: { username: p1Info.linked_game_username, avatarUrl: p1Info.avatar_url } }});
                sendInboxRefresh(p1.user_id);
                sendInboxRefresh(p2.user_id);

            } catch (err) {
                await client.query('ROLLBACK');
                console.error('[Matchmaking] Transaction failed:', err);
            } finally {
                client.release();
            }
        }
    }
};

const startMatchmakingService = () => {
    console.log(`[Matchmaking] Service started. Checking every ${MATCHMAKING_INTERVAL_SECONDS} seconds.`);
    setInterval(findAndProcessMatches, MATCHMAKING_INTERVAL_SECONDS * 1000);
};

module.exports = { startMatchmakingService };
