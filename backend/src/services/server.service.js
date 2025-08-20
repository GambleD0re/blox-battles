// /backend/src/services/server.service.js
const ServerRepository = require('../repositories/server.repository');
const config = require('../config');
const logger = require('../utils/logger');
const { pool } = require('../config/database');

class ServerService {
  /**
   * Processes a heartbeat from a game server, creating or updating its record.
   * @param {object} serverData - Data from the game server.
   * @param {string} serverData.serverId - The server's unique ID.
   * @param {string} serverData.region - The server's region.
   * @param {string} serverData.joinLink - The link to join the server.
   * @returns {Promise<void>}
   */
  static async processHeartbeat(serverData) {
    await ServerRepository.upsertHeartbeat(serverData);
    logger.debug({ serverId: serverData.serverId }, 'Heartbeat processed.');
  }

  /**
   * Finds an available server for a match and allocates slots to it.
   * This operation is transactional to prevent race conditions.
   * @param {string} region - The desired region.
   * @returns {Promise<object|null>} The server details or null if none are available.
   */
  static async allocateServer(region) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const staleThreshold = 60; // This should come from config service later
      const server = await ServerRepository.findAndLockAvailable(region, staleThreshold, client);

      if (!server) {
        await client.query('ROLLBACK');
        logger.warn({ region }, 'No available game servers found for allocation.');
        return null;
      }
      
      const playersToAllocate = 2; // Can be a game-specific rule later
      await ServerRepository.incrementPlayerCount(server.server_id, playersToAllocate, client);
      
      await client.query('COMMIT');
      logger.info({ serverId: server.server_id, region }, 'Successfully allocated server for a new match.');
      return server;

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ err: error, region }, 'Error during server allocation transaction.');
      throw new Error('Failed to allocate a game server.');
    } finally {
      client.release();
    }
  }
}

module.exports = ServerService;
