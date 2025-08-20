// /backend/src/repositories/user.repository.js
const { query } = require('../config/database');
const crypto = require('crypto');

class UserRepository {
  /**
   * Finds a user by their unique ID.
   * @param {string} id - The UUID of the user.
   * @returns {Promise<object|null>} The user object or null if not found.
   */
  static async findById(id) {
    const text = 'SELECT * FROM users WHERE id = $1';
    const values = [id];
    const { rows } = await query(text, values);
    return rows[0] || null;
  }

  /**
   * Finds a user by their email address.
   * @param {string} email - The email of the user.
   * @returns {Promise<object|null>} The user object or null if not found.
   */
  static async findByEmail(email) {
    const text = 'SELECT * FROM users WHERE email = $1';
    const values = [email];
    const { rows } = await query(text, values);
    return rows[0] || null;
  }

  /**
   * Creates a new user in the database.
   * @param {object} userData - The user data.
   * @param {string} userData.email - The user's email.
   * @param {string} userData.passwordHash - The hashed password.
   * @returns {Promise<object>} The newly created user object.
   */
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
}

module.exports = UserRepository;
