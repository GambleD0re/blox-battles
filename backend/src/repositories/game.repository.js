// /backend/src/repositories/game.repository.js
const { query } = require('../config/database');

class GameRepository {
  /**
   * Finds all active games and joins with their platform information.
   * @returns {Promise<Array<object>>} A list of active games.
   */
  static async findAllActiveGames() {
    const text = `
      SELECT
        g.id,
        g.name,
        g.short_code,
        g.description,
        g.icon_url,
        g.banner_image_url,
        g.rules_schema,
        p.name AS platform_name
      FROM games g
      JOIN platforms p ON g.platform_id = p.id
      WHERE g.is_active = TRUE
      ORDER BY g.name ASC;
    `;
    const { rows } = await query(text);
    return rows;
  }

  /**
   * Finds all game identities linked to a specific user.
   * @param {string} userId - The UUID of the user.
   * @returns {Promise<Array<object>>} A list of the user's game identities.
   */
  static async findIdentitiesByUserId(userId) {
    const text = `
      SELECT
        ugi.game_username,
        ugi.game_user_id,
        ugi.is_verified,
        ugi.metadata,
        g.name AS game_name,
        g.short_code AS game_short_code,
        g.icon_url AS game_icon_url
      FROM user_game_identities ugi
      JOIN games g ON ugi.game_id = g.id
      WHERE ugi.user_id = $1;
    `;
    const values = [userId];
    const { rows } = await query(text, values);
    return rows;
  }
}

module.exports = GameRepository;
