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
        const openRegSql = `UPDATE tournaments SET status = 'registration_open' WHERE status = 'scheduled' AND registration_opens_at <= NOW() RETURNING id`;
        const { rows: opened } = await tournamentClient.query(openRegSql);
        if (opened.length > 0) console.log(`[CRON][TOURNAMENT] Opened registration for: ${opened.map(t => t.id).join(', ')}`);

        const startSql = `SELECT * FROM tournaments WHERE status = 'registration_open' AND starts_at <= NOW()`;
        const { rows: toStart } = await tournamentClient.query(startSql);
        for (const t of toStart) {
            const txClient = await pool.connect();
            try {
                await txClient.query('BEGIN');
                const { rows: p } = await txClient.query("SELECT user_id FROM tournament_participants WHERE tournament_id = $1 ORDER BY registered_at ASC", [t.id]);
                if (p.length < 2) { await txClient.query("UPDATE tournaments SET status = 'canceled' WHERE id = $1", [t.id]); await txClient.query('COMMIT'); continue; }
                
                let players = p.map(player => player.user_id);
                if (players.length % 2 !== 0) players.push(null);
                
                for (let i = 0; i < players.length; i += 2) {
                    await txClient.query(`INSERT INTO tournament_matches (tournament_id, round_number, match_in_round, player1_id, player2_id) VALUES ($1, 1, $2, $3, $4)`, [t.id, (i/2)+1, players[i], players[i+1]]);
                }
                
                await txClient.query("UPDATE tournaments SET status = 'active' WHERE id = $1", [t.id]);
                await txClient.query('COMMIT');
                console.log(`[CRON][TOURNAMENT] Started tournament: ${t.id}`);
            } catch (err) {
                await txClient.query('ROLLBACK');
                console.error(`[CRON][TOURNAMENT] Error starting tournament ${t.id}:`, err);
            } finally {
                txClient.release();
            }
        }

        const finalizeSql = `SELECT * FROM tournaments WHERE status = 'dispute_period' AND ends_at <= NOW() - INTERVAL '${TOURNAMENT_DISPUTE_HOURS} hours'`;
        const { rows: tournamentsToFinalize } = await tournamentClient.query(finalizeSql);
        
        for (const tournament of tournamentsToFinalize) {
             const txClient = await pool.connect();
             try {
                await txClient.query('BEGIN');
                console.log(`[CRON][TOURNAMENT] Finalizing tournament ${tournament.id}`);
                const { rows: placements } = await txClient.query("SELECT user_id, placement FROM tournament_participants WHERE tournament_id = $1 AND placement IS NOT NULL ORDER BY placement ASC", [tournament.id]);
                for(const player of placements) {
                    const prize = tournament.prize_distribution[player.placement.toString()];
                    if (prize && prize > 0) {
                        await txClient.query("UPDATE users SET gems = gems + $1 WHERE id = $2", [prize, player.user_id]);
                        await txClient.query(
                            "INSERT INTO transaction_history (user_id, game_id, type, amount_gems, description, reference_id) VALUES ($1, $2, 'tournament_prize', $3, $4, $5)",
                            [player.user_id, tournament.game_id, prize, `Prize for finishing #${player.placement} in ${tournament.name}`, tournament.id]
                        );
                    }
                }
                await txClient.query("UPDATE tournaments SET status = 'finalized' WHERE id = $1", [tournament.id]);
                await txClient.query('COMMIT');
             } catch(err) {
                await txClient.query('ROLLBACK');
                console.error(`[CRON][TOURNAMENT] Error finalizing tournament ${tournament.id}:`, err);
             } finally {
                txClient.release();
             }
        }
    } catch (err) {
        console.error('[CRON][TOURNAMENT] Error processing tournament transitions:', err);
    } finally {
        tournamentClient.release();
    }

    // Duel Expiration (Accepted but not Started)
    const expirationClient = await pool.connect();
    try {
        const sql = `SELECT id, challenger_id, opponent_id, wager FROM duels WHERE status = 'accepted' AND accepted_at <= NOW() - INTERVAL '${DUEL_EXPIRATION_HOURS} hours' FOR UPDATE`;
        const { rows: duels } = await expirationClient.query(sql);
        for (const duel of duels) {
            const txClient = await pool.connect();
            try {
                await txClient.query('BEGIN');
                await txClient.query('UPDATE users SET gems = gems + $1 WHERE id = ANY($2)', [[duel.wager, duel.wager], [duel.challenger_id, duel.opponent_id]]);
                await txClient.query("UPDATE duels SET status = 'canceled' WHERE id = $1", [duel.id]);
                await txClient.query('COMMIT');
                console.log(`[CRON] Canceled expired 'accepted' duel ID ${duel.id}.`);
            } catch (txErr) {
                await txClient.query('ROLLBACK');
                console.error(`[CRON] Error expiring duel ${duel.id}:`, txErr);
            } finally {
                txClient.release();
            }
        }
    } catch (err) {
        console.error('[CRON] Error querying for expired accepted duels:', err);
    } finally {
        expirationClient.release();
    }

    // Duel Forfeits (Started)
    const forfeitClient = await pool.connect();
    try {
        const sql = `SELECT id, game_id, challenger_id, opponent_id, pot, wager, transcript, tax_collected FROM duels WHERE status = 'started' AND started_at <= NOW() - (INTERVAL '${DUEL_FORFEIT_MINUTES} minutes' + (INTERVAL '1 second' * expiration_offset_seconds)) FOR UPDATE`;
        const { rows: duels } = await forfeitClient.query(sql);
        for (const duel of duels) {
            const txClient = await pool.connect();
            try {
                await txClient.query('BEGIN');
                const { rows: [c] } = await txClient.query('SELECT linked_game_username FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
                const { rows: [o] } = await txClient.query('SELECT linked_game_username FROM user_game_profiles WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
                const transcript = duel.transcript || [];
                const joined = new Set(transcript.filter(e => e.eventType === 'PLAYER_JOINED_DUEL').map(e => e.data.playerName));
                const challengerJoined = joined.has(c.linked_game_username);
                const opponentJoined = joined.has(o.linked_game_username);

                if (!challengerJoined && !opponentJoined) {
                    let tax = parseInt(duel.tax_collected);
                    if (tax % 2 !== 0) tax++;
                    const refund = parseInt(duel.wager) - (tax / 2);
                    await txClient.query('UPDATE users SET gems = gems + $1 WHERE id = ANY($2)', [refund, [duel.challenger_id, duel.opponent_id]]);
                    await txClient.query("UPDATE duels SET status = 'canceled', tax_collected = $1 WHERE id = $2", [tax, duel.id]);
                } else if (challengerJoined && !opponentJoined) {
                    await txClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.challenger_id]);
                    await txClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
                    await txClient.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
                    await txClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.challenger_id, duel.id]);
                } else if (!challengerJoined && opponentJoined) {
                    await txClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.opponent_id]);
                    await txClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
                    await txClient.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
                    await txClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.opponent_id, duel.id]);
                } else {
                    const ready = new Set(transcript.filter(e => e.eventType === 'PLAYER_DECLARED_READY_ON_PAD').map(e => e.data.playerName));
                    const challengerReady = ready.has(c.linked_game_username);
                    const opponentReady = ready.has(o.linked_game_username);
                    if (challengerReady && !opponentReady) {
                        await txClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.challenger_id]);
                        await txClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, duel.game_id]);
                        await txClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.challenger_id, duel.id]);
                    } else if (!challengerReady && opponentReady) {
                        await txClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.opponent_id]);
                        await txClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, duel.game_id]);
                        await txClient.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.opponent_id, duel.id]);
                    } else {
                        let tax = parseInt(duel.tax_collected);
                        if (tax % 2 !== 0) tax++;
                        const refund = parseInt(duel.wager) - (tax / 2);
                        await txClient.query('UPDATE users SET gems = gems + $1 WHERE id = ANY($2)', [refund, [duel.challenger_id, duel.opponent_id]]);
                        await txClient.query("UPDATE duels SET status = 'canceled', tax_collected = $1 WHERE id = $2", [tax, duel.id]);
                    }
                }
                await decrementPlayerCount(txClient, duel.id);
                await txClient.query('COMMIT');
            } catch(err) {
                await txClient.query('ROLLBACK');
                console.error(`[CRON] Error processing forfeit for duel ${duel.id}:`, err);
            } finally {
                txClient.release();
            }
        }
    } catch (err) {
        console.error('[CRON] Error processing forfeits:', err);
    } finally {
        forfeitClient.release();
    }

    // Auto-confirm results
    const confirmClient = await pool.connect();
    try {
        const sql = `SELECT id, pot, winner_id, challenger_id, opponent_id, game_id FROM duels WHERE status = 'completed_unseen' AND result_posted_at <= NOW() - INTERVAL '${RESULT_CONFIRMATION_MINUTES} minutes' FOR UPDATE`;
        const { rows: duels } = await confirmClient.query(sql);
        for (const duel of duels) {
             const txClient = await pool.connect();
            try {
                await txClient.query('BEGIN');
                const loserId = duel.winner_id === duel.challenger_id ? duel.opponent_id : duel.challenger_id;
                await txClient.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.winner_id]);
                await txClient.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.winner_id, duel.game_id]);
                await txClient.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [loserId, duel.game_id]);
                await txClient.query("UPDATE duels SET status = 'completed' WHERE id = $1", [duel.id]);
                await txClient.query('COMMIT');
            } catch(err) {
                await txClient.query('ROLLBACK');
                console.error(`[CRON] Error auto-confirming duel ${duel.id}:`, err);
            } finally {
                txClient.release();
            }
        }
    } catch (err) {
        console.error('[CRON] Error auto-confirming results:', err);
    } finally {
        confirmClient.release();
    }

    // Server Crash Detection
    const crashClient = await pool.connect();
    try {
        const sql = `SELECT server_id FROM game_servers WHERE last_heartbeat < NOW() - INTERVAL '${SERVER_CRASH_THRESHOLD_SECONDS} seconds' FOR UPDATE`;
        const { rows: servers } = await crashClient.query(sql);
        for (const server of servers) {
            const txClient = await pool.connect();
            try {
                await txClient.query('BEGIN');
                const { rows: duels } = await txClient.query(`SELECT id, game_id, challenger_id, opponent_id, wager FROM duels WHERE assigned_server_id = $1 AND status IN ('started', 'in_progress')`, [server.server_id]);
                for (const duel of duels) {
                    await txClient.query('UPDATE users SET gems = gems + $1 WHERE id = ANY($2::uuid[])', [duel.wager, [duel.challenger_id, duel.opponent_id]]);
                    await txClient.query("UPDATE duels SET status = 'canceled', tax_collected = 0 WHERE id = $1", [duel.id]);
                    const message = `Your duel (#${duel.id}) was canceled due to a server issue. Your wager of ${duel.wager} gems has been refunded.`;
                    await txClient.query("INSERT INTO inbox_messages (user_id, game_id, type, title, message) VALUES ($1, $2, 'server_crash_refund', 'Duel Canceled: Server Issue', $3)", [duel.challenger_id, duel.game_id, message]);
                    await txClient.query("INSERT INTO inbox_messages (user_id, game_id, type, title, message) VALUES ($1, $2, 'server_crash_refund', 'Duel Canceled: Server Issue', $3)", [duel.opponent_id, duel.game_id, message]);
                }
                await txClient.query('DELETE FROM game_servers WHERE server_id = $1', [server.server_id]);
                await txClient.query('COMMIT');
            } catch(err) {
                await txClient.query('ROLLBACK');
                 console.error(`[CRON] Error handling crashed server ${server.server_id}:`, err);
            } finally {
                txClient.release();
            }
        }
    } catch (err) {
        console.error('[CRON] Error handling crashed servers:', err);
    } finally {
        crashClient.release();
    }
}

if (require.main === module) {
    runScheduledTasks()
        .then(() => {
            console.log('[CRON] Scheduled tasks finished successfully.');
            process.exit(0);
        })
        .catch(err => {
            console.error('[CRON] An unhandled error occurred during scheduled tasks:', err);
            process.exit(1);
        });
}
