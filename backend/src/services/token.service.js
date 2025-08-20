// /backend/src/services/token.service.js
const jwt = require('jsonwebtoken');
const config = require('../config');

class TokenService {
  /**
   * Generates a JWT for a given user.
   * @param {object} user - The user object from the database.
   * @returns {string} The generated JSON Web Token.
   */
  static generateAuthToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      isAdmin: user.is_admin,
      isMasterAdmin: user.is_master_admin,
    };

    const options = {
      expiresIn: config.jwt.expiresIn,
    };

    return jwt.sign(payload, config.jwt.secret, options);
  }

  /**
   * Verifies a JWT.
   * @param {string} token - The JWT to verify.
   * @returns {object|null} The decoded payload if the token is valid, otherwise null.
   */
  static verifyAuthToken(token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      return decoded;
    } catch (error) {
      return null;
    }
  }
}

module.exports = TokenService;
