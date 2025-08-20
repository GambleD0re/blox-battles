// /backend/src/services/game.service.js
const GameRepository = require('../repositories/game.repository');

class GameService {
  /**
   * Retrieves a list of all active games available on the platform.
   * @returns {Promise<Array<object>>} The list of active games.
   */
  static async getActiveGames() {
    // For now, this is a simple pass-through. In the future, this service
    // could add caching logic or transform the data from the repository.
    const games = await GameRepository.findAllActiveGames();
    return games;
  }

  /**
   * Retrieves all linked game identities for a specific user.
   * @param {string} userId - The UUID of the user.
   * @returns {Promise<Array<object>>} The user's linked game identities.
   */
  static async getUserGameIdentities(userId) {
    const identities = await GameRepository.findIdentitiesByUserId(userId);
    return identities;
  }
}

module.exports = GameService;
