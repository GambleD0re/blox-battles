// backend/cron-tasks.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const db = require('./database/database');

const decrementPlayerCount = async (client, duelId) => {
    try {
        const { rows: [duel] } = await client.query('SELECT assigned_server_id FROM duels WHERE id = $1', [duelId]);
        if (duel && duel.assigned_server_id) {
            await client.query('UPDATE game_servers SET player_count = GREATEST(0, player_count - 2) WHERE server_id = $1', [duel.assigned_server_id]);
            console.log(`[PlayerCount][CRON] Decremented player count for server ${duel.assigned_server_id} from duel ${duelId}.`);
        }
    } catch (err) {
        console.error(`[PlayerCount][CRON] Failed to decrement player count for duel ${duelId}:`, err);
    }
};

async function runScheduledTasks() {
    console.log(`[CRON] Running scheduled tasks at ${new Date().toISOString()}`);
    const pool = db.getPool();

    const DUEL_EXPIRATION_HOURS = parseInt(process.env.DUEL_EXPIRATION_HOURS || '1', 10);
    const DUEL_FORFEIT_MINUTES = parseInt(process.env.DUEL_FORFEIT_MINUTES_DIRECT || '10', 10);
    const RESULT_CONFIRMATION_MINUTES = parseInt(process.env.RESULT_CONFIRMATION_MINUTES || '2', 10);
    const SERVER_CRASH_THRESHOLD_SECONDS = parseInt(process.env.SERVER_CRASH_THRESHOLD_SECONDS || '50', 10);
    const TOURNAMENT_DISPUTE_HOURS = 1;

    const tournamentClient = await pool.connect();
    try {
        const openRegSql = `UPDATE tournaments SET status = 'registration_open' WHERE status = 'scheduled' AND registration_opens_at <= NOW() RETURNING id`;
        const { rows: openedTournaments } = await tournamentClient.query(openRegSql);
        if (openedTournaments.length > 0) {
            console.log(`[CRON][TOURNAMENT] Opened registration for tournaments: ${openedTournaments.map(t => t.id).join(', ')}`);
        }

        const startTourneySql = `SELECT * FROM tournaments WHERE status = 'registration_open' AND starts_at <= NOW()`;
        const { rows: tournamentsToStart } = await tournamentClient.query(startTourneySql);

        for (const tournament of tournamentsToStart) {
            const { rows: participants } = await tournamentClient.query("SELECT user_id FROM tournament_participants WHERE tournament_id = $1 ORDER BY registered_at ASC", [tournament.id]);
            if (participants.length < 2) {
                await tournamentClient.query("UPDATE tournaments SET status = 'canceled' WHERE id = $1", [tournament.id]);
                continue;
            }
            let players = participants.map(p => p.user_id);
            if (players.length % 2 !== 0) { players.push(null); }
            let matchInRound = 1;
            for (let i = 0; i < players.length; i += 2) {
                await tournamentClient.query(`INSERT INTO tournament_matches (tournament_id, round_number, match_in_round, player1_id, player2_id) VALUES ($1, 1, $2, $3, $4)`, [tournament.id, matchInRound, players[i], players[i+1]]);
                matchInRound++;
            }
            const taskPayload = { tournamentId: tournament.id, round: 1, rules: tournament.rules, serverLink: tournament.private_server_link, gameId: tournament.game_id };
            await tournamentClient.query("INSERT INTO tasks (task_type, payload) VALUES ('START_TOURNAMENT', $1)", [JSON.stringify(taskPayload)]);
            await tournamentClient.query("UPDATE tournaments SET status = 'active' WHERE id = $1", [tournament.id]);
            console.log(`[CRON][TOURNAMENT] Starting tournament ID: ${tournament.id}`);
        }
        
        const finalizeSql = `SELECT * FROM tournaments WHERE status = 'dispute_period' AND ends_at <= NOW() - INTERVAL '${TOURNAMENT_DISPUTE_HOURS} hours'`;
        const { rows: tournamentsToFinalize } = await tournamentClient.query(finalizeSql);
        
        for (const tournament of tournamentsToFinalize) {
            const { rows: placements } = await tournamentClient.query("SELECT user_id, placement FROM tournament_participants WHERE tournament_id = $1 AND placement IS NOT NULL ORDER BY placement ASC", [tournament.id]);
            for(const player of placements) {
                const prize = tournament.prize_distribution[player.placement.toString()];
                if (prize && prize > 0) {
                    await tournamentClient.query("UPDATE users SET gems = gems + $1 WHERE id = $2", [prize, player.user_id]);
                    await tournamentClient.query("INSERT INTO transaction_history (user_id, game_id, type, amount_gems, description, reference_id) VALUES ($1, $2, 'tournament_prize', $3, $4, $5)", [player.user_id, tournament.game_id, prize, `Prize for finishing #${player.placement} in ${tournament.name}`, tournament.id]);
                }
            }
            await tournamentClient.query("UPDATE tournaments SET status = 'finalized' WHERE id = $1", [tournament.id]);
            console.log(`[CRON][TOURNAMENT] Finalizing tournament ${tournament.id}`);
        }
    } catch (error) {
        console.error('[CRON][TOURNAMENT] Error processing tournament transitions:', error);
    } finally {
        tournamentClient.release();
    }
    
    const expirationClient = await pool.connect();
    try {
        const acceptedSql = `
            SELECT id, challenger_id, opponent_id, wager 
            FROM duels 
            WHERE status = 'accepted' AND accepted_at <= NOW() - INTERVAL '${DUEL_EXPIRATION_HOURS} hours'
        `;
        const { rows: expiredAcceptedDuels } = await expirationClient.query(acceptedSql);
        for (const duel of expiredAcceptedDuels) {
            await expirationClient.query('BEGIN');
            await expirationClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.challenger_id]);
            await expirationClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.opponent_id]);
            await expirationClient.query("UPDATE duels SET status = 'canceled' WHERE id = $1", [duel.id]);
            await expirationClient.query('COMMIT');
            console.log(`[CRON] Canceled expired 'accepted' duel ID ${duel.id}. Wager refunded.`);
        }
    } catch (error) {
        await expirationClient.query('ROLLBACK');
        console.error('[CRON] Error querying for old accepted duels:', error);
    } finally {
        expirationClient.release();
    }

    const forfeitClient = await pool.connect();
    try {
        const startedSql = `
            SELECT id, game_id, challenger_id, opponent_id, pot, wager, transcript, tax_collected
            FROM duels 
            WHERE status = 'started' AND started_at <= NOW() - (INTERVAL '${DUEL_FORFEIT_MINUTES} minutes' + (INTERVAL '1 second' * expiration_offset_seconds))
        `;
        const { rows: expiredStartedDuels } = await forfeitClient.query(startedSql);
        for (const duel of expiredStartedDuels) {
            const { rows: [challenger] } = await forfeitClient.query('SELECT linked_game_username FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
            const { rows: [opponent] } = await forfeitClient.query('SELECT linked_game_username FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
            const transcript = duel.transcript || [];
            const joinedPlayers = new Set(transcript.filter(event => event.eventType === 'PLAYER_JOINED_DUEL').map(event => event.data.playerName));

            if (!joinedPlayers.has(challenger.linked_game_username) && !joinedPlayers.has(opponent.linked_game_username)) {
                await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.challenger_id]);
                await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.opponent_id]);
                await forfeitClient.query("UPDATE duels SET status = 'canceled', winner_id = NULL WHERE id = $1", [duel.id]);
            } else if (joinedPlayers.has(challenger.linked_game_username) && !joinedPlayers.has(opponent.linked_game_username)) {
                await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.challenger_id]);
                await forfeitClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
                await forfeitClient.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
                await forfeitClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.challenger_id, duel.id]);
            } else if (!joinedPlayers.has(challenger.linked_game_username) && joinedPlayers.has(opponent.linked_game_username)) {
                await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.opponent_id]);
                await forfeitClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
                await forfeitClient.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
                await forfeitClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.opponent_id, duel.id]);
            }
            await decrementPlayerCount(forfeitClient, duel.id);
            console.log(`[CRON] Duel ID ${duel.id} processed for forfeit.`);
        }
    } catch (error) {
        console.error('[CRON] Error querying for timed-out started duels:', error);
    } finally {
        forfeitClient.release();
    }
    
    const confirmationClient = await pool.connect();
    try {
        const confirmationSql = `
            SELECT id, pot, winner_id, challenger_id, opponent_id, game_id
            FROM duels
            WHERE status = 'completed_unseen' AND result_posted_at <= NOW() - INTERVAL '${RESULT_CONFIRMATION_MINUTES} minutes'
        `;
        const { rows: expiredConfirmations } = await confirmationClient.query(confirmationSql);
        for (const duel of expiredConfirmations) {
            const loserId = (duel.winner_id.toString() === duel.challenger_id.toString()) ? duel.opponent_id : duel.challenger_id;
            await confirmationClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.winner_id]);
            await confirmationClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.winner_id, duel.game_id]);
            await confirmationClient.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [loserId, duel.game_id]);
            await confirmationClient.query("UPDATE duels SET status = 'completed' WHERE id = $1", [duel.id]);
            console.log(`[CRON] Auto-confirmed duel ID ${duel.id}.`);
        }
    } catch (error) {
        console.error('[CRON] Error querying for expired confirmations:', error);
    } finally {
        confirmationClient.release();
    }

    const crashClient = await pool.connect();
    try {
        const staleServerSql = `SELECT server_id FROM game_servers WHERE last_heartbeat < NOW() - INTERVAL '${SERVER_CRASH_THRESHOLD_SECONDS} seconds'`;
        const { rows: crashedServers } = await crashClient.query(staleServerSql);
        for (const server of crashedServers) {
            const { rows: affectedDuels } = await crashClient.query(`SELECT id, game_id, challenger_id, opponent_id, wager FROM duels WHERE assigned_server_id = $1 AND status IN ('started', 'in_progress')`, [server.server_id]);
            for (const duel of affectedDuels) {
                await crashClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.challenger_id]);
                await crashClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.opponent_id]);
                const refundDesc = `Refund for Duel #${duel.id} due to server issues.`;
                await crashClient.query("INSERT INTO transaction_history (user_id, game_id, type, amount_gems, description, reference_id) VALUES ($1, $2, 'server_crash_refund', $3, $4, $5)", [duel.challenger_id, duel.game_id, duel.wager, refundDesc, duel.id]);
                await crashClient.query("INSERT INTO transaction_history (user_id, game_id, type, amount_gems, description, reference_id) VALUES ($1, $2, 'server_crash_refund', $3, $4, $5)", [duel.opponent_id, duel.game_id, duel.wager, refundDesc, duel.id]);
                await crashClient.query("UPDATE duels SET status = 'canceled' WHERE id = $1", [duel.id]);
                console.log(`[CRON][CRASH] Voided duel ${duel.id} and refunded players.`);
            }
            await crashClient.query('DELETE FROM game_servers WHERE server_id = $1', [server.server_id]);
            console.log(`[CRON][CRASH] Pruned crashed server ${server.server_id}.`);
        }
    } catch (error) {
        console.error('[CRON][CRASH] Error querying for crashed servers:', error);
    } finally {
        crashClient.release();
    }
}

if (require.main === module) {
    runScheduledTasks();
}
