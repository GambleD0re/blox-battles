// /backend/src/repositories/server.repository.js
const { query } = require('../config/database');

class ServerRepository {
  /**
   * Records a heartbeat from a game server.
   * Inserts a new server record or updates the existing one's heartbeat.
   * @param {object} serverData - The server's data.
   * @param {string} serverData.serverId - The unique ID of the server.
   * @param {string} serverData.region - The region the server is in.
   * @param {string} serverData.joinLink - The Roblox join link.
   * @returns {Promise<void>}
   */
  static async upsertHeartbeat(serverData) {
    const { serverId, region, joinLink } = serverData;
    const text = `
      INSERT INTO game_servers (server_id, region, join_link, last_heartbeat)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (server_id) DO UPDATE SET
        join_link = EXCLUDED.join_link,
        last_heartbeat = NOW();
    `;
    const values = [serverId, region, joinLink];
    await query(text, values);
  }

  /**
   * Finds the best available server for a match in a given region for a specific game.
   * This query finds the least populated, online server and locks the row for update
   * to prevent race conditions where two matches are assigned to the same server slots.
   * @param {string} region - The desired server region.
   * @param {number} staleThresholdSeconds - The time in seconds to consider a server offline.
   * @param {object} client - An active pg client for transactional integrity.
   * @returns {Promise<object|null>} The best available server or null.
   */
  static async findAndLockAvailable(region, staleThresholdSeconds, client) {
    const text = `
      SELECT server_id, join_link
      FROM game_servers
      WHERE region = $1
        AND player_count < 40 -- This should be a config value later
        AND last_heartbeat >= NOW() - INTERVAL '${staleThresholdSeconds} seconds'
      ORDER BY player_count ASC
      LIMIT 1
      FOR UPDATE;
    `;
    const values = [region];
    const { rows } = await client.query(text, values);
    return rows[0] || null;
  }

  /**
   * Increments the player count for a given server.
   * @param {string} serverId - The ID of the server to update.
   * @param {number} incrementBy - The number to increase the player count by.
   * @param {object} client - An active pg client for transactional integrity.
   * @returns {Promise<void>}
   */
  static async incrementPlayerCount(serverId, incrementBy, client) {
    const text = `
      UPDATE game_servers
      SET player_count = player_count + $1
      WHERE server_id = $2;
    `;
    const values = [incrementBy, serverId];
    await client.query(text, values);
  }
}

module.exports = ServerRepository;
