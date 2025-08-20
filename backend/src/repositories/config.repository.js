// /backend/src/repositories/config.repository.js

import pool from '../config/database.js';

class ConfigRepository {
  /**
   * Fetches all key-value pairs from the platform_config table.
   * @returns {Promise<Array<{key: string, value: object}>>} A promise that resolves to an array of config objects.
   */
  static async findAll() {
    const queryText = 'SELECT key, value FROM platform_config';
    const { rows } = await pool.query(queryText);
    return rows;
  }
}

export default ConfigRepository;
