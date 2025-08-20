// /backend/src/repositories/duel.repository.js
const { query } = require('../config/database');

class DuelRepository {
  /**
   * Creates a new duel record in the database using the Core + Properties model.
   * @param {object} duelData - The data for the new duel.
   * @param {string} duelData.challengerId - The challenger's user ID (UUID).
   * @param {string} duelData.opponentId - The opponent's user ID (UUID).
   * @param {number} duelData.gameId - The ID of the game being played.
   * @param {number} duelData.wager - The amount of gems wagered.
   * @param {object} duelData.matchParameters - A JSON object with game-specific settings.
   * @returns {Promise<object>} The newly created duel object.
   */
  static async create(duelData) {
    const {
      challengerId,
      opponentId,
      gameId,
      wager,
      matchParameters
    } = duelData;

    const text = `
      INSERT INTO duels 
        (challenger_id, opponent_id, game_id, wager, match_parameters, status)
      VALUES 
        ($1, $2, $3, $4, $5, 'pending')
      RETURNING *;
    `;

    const values = [
      challengerId,
      opponentId,
      gameId,
      wager,
      JSON.stringify(matchParameters || {}),
    ];

    const { rows } = await query(text, values);
    return rows[0];
  }

  /**
   * Finds a duel by its unique ID.
   * @param {number} id - The ID of the duel.
   * @returns {Promise<object|null>} The duel object or null if not found.
   */
  static async findById(id) {
    const text = 'SELECT * FROM duels WHERE id = $1';
    const values = [id];
    const { rows } = await query(text, values);
    return rows[0] || null;
  }

  /**
   * Updates the status of a specific duel.
   * @param {number} id - The ID of the duel to update.
   * @param {string} status - The new status for the duel.
   * @returns {Promise<object>} The updated duel object.
   */
  static async updateStatus(id, status) {
    const text = `
      UPDATE duels
      SET status = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    const values = [status, id];
    const { rows } = await query(text, values);
    return rows[0];
  }
}

module.exports = DuelRepository;
