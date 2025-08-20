// /backend/src/modules/games/BaseGameHandler.js
/**
 * Abstract Base Class for Game Handlers.
 * This class defines the interface that all game-specific logic handlers
 * must implement. It ensures a consistent contract for services like
 * MatchmakingService to interact with any game on the platform.
 */
class BaseGameHandler {
  constructor(game) {
    if (this.constructor === BaseGameHandler) {
      throw new Error("Abstract classes can't be instantiated.");
    }
    /**
     * The game object from the database, containing rules and metadata.
     * @type {object}
     * @protected
     */
    this.game = game;
  }

  /**
   * Validates that the provided match parameters conform to the game's rules_schema.
   * @param {object} matchParameters - The game-specific parameters for a duel.
   * @returns {{isValid: boolean, error: string|null}} Validation result.
   */
  validateParameters(matchParameters) {
    throw new Error("Method 'validateParameters()' must be implemented.");
  }

  /**
   * Creates the specific payload for a 'REFEREE_DUEL' task for this game.
   * @param {object} duel - The full duel object from the database.
   * @param {object} server - The allocated server object.
   * @param {object} challenger - The challenger's user & game identity.
   * @param {object} opponent - The opponent's user & game identity.
   * @returns {Promise<object>} The payload to be stored in the tasks table.
   */
  async createMatchTask(duel, server, challenger, opponent) {
    throw new Error("Method 'createMatchTask()' must be implemented.");
  }

  /**
   * Processes the final result event from a game's referee (e.g., a bot or webhook).
   * @param {object} duel - The full duel object from the database.
   * @param {object} resultPayload - The data received from the referee.
   * @returns {Promise<{winnerId: string, loserId: string, transcript: object}>} The processed result.
   */
  async processMatchResult(duel, resultPayload) {
    throw new Error("Method 'processMatchResult()' must be implemented.");
  }
}

module.exports = BaseGameHandler;
