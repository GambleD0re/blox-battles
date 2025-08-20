// /backend/src/repositories/user.repository.js
const { query } = require('../config/database');
const crypto = require('crypto');

class UserRepository {
  static async findById(id) {
    const text = 'SELECT * FROM users WHERE id = $1';
    const values = [id];
    const { rows } = await query(text, values);
    return rows[0] || null;
  }

  static async findByEmail(email) {
    const text = 'SELECT * FROM users WHERE email = $1';
    const values = [email];
    const { rows } = await query(text, values);
    return rows[0] || null;
  }

  static async create({ email, passwordHash }) {
    const id = crypto.randomUUID();
    const text = `
      INSERT INTO users (id, email, password_hash, is_email_verified)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [id, email, passwordHash, false];
    const { rows } = await query(text, values);
    return rows[0];
  }

  /**
   * Searches and filters users for the admin panel.
   * @param {object} filters - The search and filter criteria.
   * @param {string} [filters.query] - A search query for email or username.
   * @param {string} [filters.status] - A specific status to filter by.
   * @param {number} [limit=50] - The maximum number of users to return.
   * @returns {Promise<Array<object>>} A list of matching users.
   */
  static async searchAndFilter({ query: searchQuery, status }, limit = 50) {
    let text = `
      SELECT id, email, linked_roblox_username, gems, wins, losses, is_admin, status, 
             ban_applied_at, ban_expires_at, ban_reason, created_at
      FROM users
    `;
    const values = [];
    const conditions = [];
    
    if (searchQuery) {
      values.push(`%${searchQuery}%`);
      conditions.push(`(email ILIKE $${values.length} OR linked_roblox_username ILIKE $${values.length})`);
    }
    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }

    if (conditions.length > 0) {
      text += ` WHERE ` + conditions.join(' AND ');
    }

    text += ` ORDER BY created_at DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    const { rows } = await query(text, values);
    return rows;
  }

  /**
   * Updates a user's status and ban information.
   * @param {string} id - The UUID of the user to update.
   * @param {object} banDetails - The details of the ban.
   * @param {string} banDetails.status - The new status ('banned' or 'active').
   * @param {string|null} [banDetails.reason] - The reason for the ban.
   * @param {string|null} [banDetails.expiresAt] - The ISO timestamp for when the ban expires.
   * @returns {Promise<object>} The updated user.
   */
  static async updateStatus(id, { status, reason, expiresAt }) {
    const text = `
      UPDATE users SET 
        status = $1, 
        ban_reason = $2, 
        ban_expires_at = $3, 
        ban_applied_at = CASE WHEN $1 = 'banned' THEN NOW() ELSE NULL END
      WHERE id = $4
      RETURNING *;
    `;
    const values = [status, reason, expiresAt, id];
    const { rows } = await query(text, values);
    return rows[0];
  }
}

module.exports = UserRepository;
