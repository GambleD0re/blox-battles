// /backend/src/services/duel.service.js
const DuelRepository = require('../repositories/duel.repository');
const UserRepository = require('../repositories/user.repository');
const GameRepository = require('../repositories/game.repository'); // We will need this now
const TaskService = require('./task.service'); // To be created
// const GameService = require('./game.service'); // We'll need a way to validate rules

class DuelService {
  /**
   * Creates a direct challenge between two users for a specific game.
   * @param {string} challengerId - The user ID of the challenger.
   * @param {object} challengeData - The details of the challenge.
   * @param {string} challengeData.opponentId - The user ID of the opponent.
   * @param {number} challengeData.gameId - The ID of the game.
   * @param {number} challengeData.wager - The gem wager.
   * @param {object} challengeData.matchParameters - The game-specific rules.
   * @returns {Promise<object>} The newly created duel record.
   */
  static async createDirectChallenge(challengerId, challengeData) {
    const { opponentId, gameId, wager, matchParameters } = challengeData;

    // --- Validation Step 1: Fetch Core Entities ---
    const [challenger, opponent, game] = await Promise.all([
      UserRepository.findById(challengerId),
      UserRepository.findById(opponentId),
      // GameRepository.findById(gameId) // This method will be created later
    ]);

    if (!challenger || !opponent) {
      const error = new Error('Challenger or opponent not found.');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }
    
    // --- Validation Step 2: Business Logic Rules ---
    if (challenger.gems < wager) {
      const error = new Error('You do not have enough gems for this wager.');
      error.statusCode = 400;
      error.code = 'INSUFFICIENT_FUNDS';
      throw error;
    }
    
    // --- Validation Step 3: Game-Specific Rules ---
    // Here, we would fetch the game's `rules_schema` from the `game` object.
    // We would then validate that the incoming `matchParameters` object
    // conforms to that schema. This is a crucial step for data integrity.
    // Example: GameService.validateParameters(game.rules_schema, matchParameters);
    
    const duelData = {
      challengerId,
      opponentId,
      gameId,
      wager,
      matchParameters
    };

    const newDuel = await DuelRepository.create(duelData);

    // --- Post-Creation Actions ---
    // await TaskService.queueDuelChallengeNotification(newDuel);
    
    return newDuel;
  }
}

module.exports = DuelService;
