// /backend/src/services/config.service.js

import ConfigRepository from '../repositories/config.repository.js';
import logger from '../utils/logger.js';

const configCache = new Map();
let isInitialized = false;

class ConfigService {
  /**
   * Initializes the configuration service by loading all settings from the database into an in-memory cache.
   * This should be called once on application startup.
   * @returns {Promise<void>}
   */
  static async initialize() {
    try {
      logger.info('Initializing dynamic configuration service...');
      const configs = await ConfigRepository.findAll();

      for (const config of configs) {
        configCache.set(config.key, config.value);
      }

      isInitialized = true;
      logger.info(`Successfully loaded and cached ${configCache.size} platform configurations.`);
    } catch (error) {
      logger.error('FATAL: Could not initialize dynamic configuration from database.', error);
      throw new Error('Failed to initialize platform configuration.');
    }
  }

  /**
   * Retrieves a configuration value from the cache.
   * @param {string} key - The key of the configuration to retrieve.
   * @param {*} [defaultValue=null] - The value to return if the key is not found.
   * @returns {*} The configuration value or the default value.
   */
  static get(key, defaultValue = null) {
    if (!isInitialized) {
      logger.warn(`ConfigService accessed before initialization. Key: ${key}`);
      return defaultValue;
    }
    return configCache.get(key) ?? defaultValue;
  }
}

export default ConfigService;
