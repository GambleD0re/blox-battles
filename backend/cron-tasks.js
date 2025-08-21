// backend/cron-tasks.js
require('dotenv').config({ path: require('path').resolve(__dirname, './.env') });
const db = require('./database/database');

const RIVALS_GAME_ID = 'rivals';

async function runScheduledTasks() {
    console.log(`[CRON] Running scheduled tasks at ${new Date().toISOString()}`);
    const pool = db.getPool();

    const DUEL_EXPIRATION_HOURS = parseInt(process.env.DUEL_EXPIRATION_HOURS || '1', 10);
    const DUEL_FORFEIT_MINUTES_DIRECT = parseInt(process.env.DUEL_FORFEIT_MINUTES_DIRECT || '10', 10);
    const DUEL_FORFEIT_MINUTES_RANDOM = parseFloat(process.env.DUEL_FORFEIT_MINUTES_RANDOM || '3');
    const RESULT_CONFIRMATION_MINUTES = parseInt(process.env.RESULT_CONFIRMATION_MINUTES || '2', 10);
    const SERVER_CRASH_THRESHOLD_SECONDS = parseInt(process.env.SERVER_CRASH_THRESHOLD_SECONDS || '50', 10);

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const forfeitSql = `
            SELECT id, challenger_id, opponent_id, pot, wager, transcript
            FROM duels 
            WHERE status = 'started' AND started_at <= NOW() - INTERVAL '10 minutes'
        `;
        const { rows: expiredStartedDuels } = await client.query(forfeitSql);
        for (const duel of expiredStartedDuels) {
            const { rows: [challenger] } = await client.query('SELECT ugp.linked_game_username FROM user_game_profiles ugp WHERE ugp.user_id = $1 AND ugp.game_id = $2', [duel.challenger_id, RIVALS_GAME_ID]);
            const { rows: [opponent] } = await client.query('SELECT ugp.linked_game_username FROM user_game_profiles ugp WHERE ugp.user_id = $1 AND ugp.game_id = $2', [duel.opponent_id, RIVALS_GAME_ID]);

            const joinedPlayers = new Set((duel.transcript || []).filter(e => e.eventType === 'PLAYER_JOINED_DUEL').map(e => e.data.playerName));
            
            if (joinedPlayers.has(challenger.linked_game_username) && !joinedPlayers.has(opponent.linked_game_username)) {
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.challenger_id]);
                await client.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, RIVALS_GAME_ID]);
                await client.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, RIVALS_GAME_ID]);
                await client.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.challenger_id, duel.id]);
            } else if (!joinedPlayers.has(challenger.linked_game_username) && joinedPlayers.has(opponent.linked_game_username)) {
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.pot, duel.opponent_id]);
                await client.query('UPDATE user_game_profiles SET wins = wins + 1 WHERE user_id = $1 AND game_id = $2', [duel.opponent_id, RIVALS_GAME_ID]);
                await client.query('UPDATE user_game_profiles SET losses = losses + 1 WHERE user_id = $1 AND game_id = $2', [duel.challenger_id, RIVALS_GAME_ID]);
                await client.query("UPDATE duels SET status = 'completed', winner_id = $1 WHERE id = $2", [duel.opponent_id, duel.id]);
            } else {
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.challenger_id]);
                await client.query('UPDATE users SET gems = gems + $1 WHERE id = $2', [duel.wager, duel.opponent_id]);
                await client.query("UPDATE duels SET status = 'canceled' WHERE id = $1", [duel.id]);
            }
        }
        
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[CRON] Error during scheduled tasks:', error);
    } finally {
        client.release();
    }
}

if (require.main === module) {
    runScheduledTasks();
}
