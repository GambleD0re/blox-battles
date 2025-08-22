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

    // Tournament Management
    const tournamentClient = await pool.connect();
    try {
        await tournamentClient.query('BEGIN');
        const openRegSql = `UPDATE tournaments SET status = 'registration_open' WHERE status = 'scheduled' AND registration_opens_at <= NOW() RETURNING id`;
        const { rows: opened } = await tournamentClient.query(openRegSql);
        if (opened.length > 0) console.log(`[CRON][TOURNAMENT] Opened registration for: ${opened.map(t => t.id).join(', ')}`);

        const startSql = `SELECT * FROM tournaments WHERE status = 'registration_open' AND starts_at <= NOW()`;
        const { rows: toStart } = await tournamentClient.query(startSql);
        for (const t of toStart) {
            const { rows: p } = await tournamentClient.query("SELECT user_id FROM tournament_participants WHERE tournament_id = $1", [t.id]);
            if (p.length < 2) { await tournamentClient.query("UPDATE tournaments SET status = 'canceled' WHERE id = $1", [t.id]); continue; }
            let players = p.map(player => player.user_id);
            if (players.length % 2 !== 0) players.push(null);
            for (let i = 0; i < players.length; i += 2) {
                await tournamentClient.query(`INSERT INTO tournament_matches (tournament_id, round_number, match_in_round, player1_id, player2_id) VALUES ($1, 1, $2, $3, $4)`, [t.id, (i/2)+1, players[i], players[i+1]]);
            }
            await tournamentClient.query("UPDATE tournaments SET status = 'active' WHERE id = $1", [t.id]);
            console.log(`[CRON][TOURNAMENT] Started tournament: ${t.id}`);
        }
        await tournamentClient.query('COMMIT');
    } catch (err) {
        await tournamentClient.query('ROLLBACK');
        console.error('[CRON][TOURNAMENT] Error:', err);
    } finally {
        tournamentClient.release();
    }

    // Duel Expiration (Accepted but not Started)
    const expirationClient = await pool.connect();
    try {
        await expirationClient.query('BEGIN');
        const sql = `SELECT id, challenger_id, opponent_id, wager FROM duels WHERE status = 'accepted' AND accepted_at <= NOW() - INTERVAL '${DUEL_EXPIRATION_HOURS} hours' FOR UPDATE`;
        const { rows: duels } = await expirationClient.query(sql);
        for (const duel of duels) {
            await expirationClient.query('UPDATE users SET gems = gems + $1 WHERE id = ANY($2)', [duel.wager, [duel.challenger_id, duel.opponent_id]]);
            await expirationClient.query("UPDATE duels SET status = 'canceled' WHERE id = $1", [duel.id]);
            console.log(`[CRON] Canceled expired 'accepted' duel ID ${duel.id}.`);
        }
        await expirationClient.query('COMMIT');
    } catch (err) {
        await expirationClient.query('ROLLBACK');
        console.error('[CRON] Error expiring accepted duels:', err);
    } finally {
        expirationClient.release();
    }

    // Duel Forfeits (Started)
    const forfeitClient = await pool.connect();
    try {
        const sql = `SELECT id, game_id, challenger_id, opponent_id, pot, wager, transcript, tax_collected FROM duels WHERE status = 'started' AND started_at <= NOW() - (INTERVAL '${DUEL_FORFEIT_MINUTES} minutes' + (INTERVAL '1 second' * expiration_offset_seconds)) FOR UPDATE`;
        const { rows: duels } = await forfeitClient.query(sql);
        for (const duel of duels) {
            await forfeitClient.query('BEGIN');
            const { rows: [c] } = await forfeitClient.query('SELECT linked_game_username FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
            const { rows: [o] } = await forfeitClient.query('SELECT linked_game_username FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
            const transcript = duel.transcript || [];
            const joined = new Set(transcript.filter(e => e.eventType === 'PLAYER_JOINED_DUEL').map(e => e.data.playerName));
            const challengerJoined = joined.has(c.linked_game_username);
            const opponentJoined = joined.has(o.linked_game_username);

            if (!challengerJoined && !opponentJoined) {
                let tax = parseInt(duel.tax_collected);
                if (tax % 2 !== 0) tax++;
                const refund = parseInt(duel.wager) - (tax / 2);
                await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = ANY($2)', [refund, [duel.challenger_id, duel.opponent_id]]);
                await forfeitClient.query("UPDATE duels SET status = 'canceled', tax_collected = $1 WHERE id = $2", [tax, duel.id]);
            } else if (challengerJoined && !opponentJoined) {
                await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.challenger_id]);
                await forfeitClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
                await forfeitClient.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
                await forfeitClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.challenger_id, duel.id]);
            } else if (!challengerJoined && opponentJoined) {
                await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.opponent_id]);
                await forfeitClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
                await forfeitClient.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
                await forfeitClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.opponent_id, duel.id]);
            } else {
                const ready = new Set(transcript.filter(e => e.eventType === 'PLAYER_DECLARED_READY_ON_PAD').map(e => e.data.playerName));
                const challengerReady = ready.has(c.linked_game_username);
                const opponentReady = ready.has(o.linked_game_username);
                if (challengerReady && !opponentReady) {
                    await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.challenger_id]);
                    await forfeitClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
                    await forfeitClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.challenger_id, duel.id]);
                } else if (!challengerReady && opponentReady) {
                    await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.opponent_id]);
                    await forfeitClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
                    await forfeitClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.opponent_id, duel.id]);
                } else {
                    let tax = parseInt(duel.tax_collected);
                    if (tax % 2 !== 0) tax++;
                    const refund = parseInt(duel.wager) - (tax / 2);
                    await forfeitClient.query('UPDATE users SET gems = gems + $1 WHERE id = ANY($2)', [refund, [duel.challenger_id, duel.opponent_id]]);
                    await forfeitClient.query("UPDATE duels SET status = 'canceled', tax_collected = $1 WHERE id = $2", [tax, duel.id]);
                }
            }
            await decrementPlayerCount(forfeitClient, duel.id);
            await forfeitClient.query('COMMIT');
        }
    } catch (err) {
        await forfeitClient.query('ROLLBACK');
        console.error('[CRON] Error processing forfeits:', err);
    } finally {
        forfeitClient.release();
    }

    // Auto-confirm results
    const confirmClient = await pool.connect();
    try {
        await confirmClient.query('BEGIN');
        const sql = `SELECT id, pot, winner_id, challenger_id, opponent_id, game_id FROM duels WHERE status = 'completed_unseen' AND result_posted_at <= NOW() - INTERVAL '${RESULT_CONFIRMATION_MINUTES} minutes' FOR UPDATE`;
        const { rows: duels } = await confirmClient.query(sql);
        for (const duel of duels) {
            const loserId = duel.winner_id === duel.challenger_id ? duel.opponent_id : duel.challenger_id;
            await confirmClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.winner_id]);
            await confirmClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.winner_id, duel.game_id]);
            await confirmClient.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [loserId, duel.game_id]);
            await confirmClient.query("UPDATE duels SET status = 'completed' WHERE id = $1", [duel.id]);
        }
        await confirmClient.query('COMMIT');
    } catch (err) {
        await confirmClient.query('ROLLBACK');
        console.error('[CRON] Error auto-confirming results:', err);
    } finally {
        confirmClient.release();
    }

    // Server Crash Detection
    const crashClient = await pool.connect();
    try {
        await crashClient.query('BEGIN');
        const sql = `SELECT server_id FROM game_servers WHERE last_heartbeat < NOW() - INTERVAL '${SERVER_CRASH_THRESHOLD_SECONDS} seconds' FOR UPDATE`;
        const { rows: servers } = await crashClient.query(sql);
        for (const server of servers) {
            const { rows: duels } = await crashClient.query(`SELECT id, game_id, challenger_id, opponent_id, wager FROM duels WHERE assigned_server_id = $1 AND status IN ('started', 'in_progress')`, [server.server_id]);
            for (const duel of duels) {
                await crashClient.query('UPDATE users SET gems = gems + $1 WHERE id = ANY($2)', [duel.wager, [duel.challenger_id, duel.opponent_id]]);
                await crashClient.query("UPDATE duels SET status = 'canceled' WHERE id = $1", [duel.id]);
                await crashClient.query("INSERT INTO inbox_messages (user_id, game_id, type, title, message) VALUES ($1, $2, 'server_crash_refund', 'Duel Canceled: Server Issue', 'Your duel (#${duel.id}) was canceled due to a server issue. Your wager of ${duel.wager} gems has been refunded.')", [duel.challenger_id, duel.game_id]);
                await crashClient.query("INSERT INTO inbox_messages (user_id, game_id, type, title, message) VALUES ($1, $2, 'server_crash_refund', 'Duel Canceled: Server Issue', 'Your duel (#${duel.id}) was canceled due to a server issue. Your wager of ${duel.wager} gems has been refunded.')", [duel.opponent_id, duel.game_id]);
            }
            await crashClient.query('DELETE FROM game_servers WHERE server_id = $1', [server.server_id]);
        }
        await crashClient.query('COMMIT');
    } catch (err) {
        await crashClient.query('ROLLBACK');
        console.error('[CRON] Error handling crashed servers:', err);
    } finally {
        crashClient.release();
    }
    
    // Dispute Forfeits
    const disputeClient = await pool.connect();
    try {
        await disputeClient.query('BEGIN');
        const sql = `SELECT d.id, d.duel_id, du.reported_id, du.pot FROM disputes d JOIN duels du ON d.duel_id = du.id WHERE d.status = 'awaiting_user_discord_link' AND d.discord_forwarded_at < NOW() - INTERVAL '24 hours' FOR UPDATE`;
        const { rows: disputes } = await disputeClient.query(sql);
        for (const dispute of disputes) {
            await disputeClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [dispute.pot, dispute.reported_id]);
            await disputeClient.query('UPDATE duels SET status = "completed" WHERE id = $1', [dispute.duel_id]);
            await disputeClient.query("UPDATE disputes SET status = 'resolved', resolution = 'Reporter failed to link Discord in 24 hours.' WHERE id = $1", [dispute.id]);
        }
        await disputeClient.query('COMMIT');
    } catch(err) {
        await disputeClient.query('ROLLBACK');
        console.error('[CRON] Error forfeiting disputes:', err);
    } finally {
        disputeClient.release();
    }
}

if (require.main === module) {
    runScheduledTasks();
}
