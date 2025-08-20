// /backend/src/services/password.service.js
const bcrypt = require('bcryptjs');

const saltRounds = 10;

class PasswordService {
  /**
   * Hashes a plaintext password.
   * @param {string} plaintextPassword - The password to hash.
   * @returns {Promise<string>} The resulting password hash.
   */
  static async hashPassword(plaintextPassword) {
    const hash = await bcrypt.hash(plaintextPassword, saltRounds);
    return hash;
  }

  /**
   * Compares a plaintext password against a hash.
   * @param {string} plaintextPassword - The password provided by the user.
   * @param {string} hash - The hash stored in the database.
   * @returns {Promise<boolean>} True if the password matches the hash, false otherwise.
   */
  static async comparePassword(plaintextPassword, hash) {
    const isMatch = await bcrypt.compare(plaintextPassword, hash);
    return isMatch;
  }
}

module.exports = PasswordService;
