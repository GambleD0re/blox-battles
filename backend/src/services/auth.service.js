// /backend/src/services/auth.service.js
const UserRepository = require('../repositories/user.repository');
const PasswordService = require('./password.service');
const TokenService = require('./token.service');
// const EmailService = require('./email.service'); // Will be used later for verification

class AuthService {
  /**
   * Registers a new user.
   * @param {string} email - The user's email.
   * @param {string} password - The user's plaintext password.
   * @returns {Promise<{user: object, token: string}>} The new user and a JWT.
   */
  static async register(email, password) {
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      const error = new Error('An account with this email already exists.');
      error.statusCode = 409;
      error.code = 'EMAIL_IN_USE';
      throw error;
    }

    const passwordHash = await PasswordService.hashPassword(password);
    
    const newUser = await UserRepository.create({ email, passwordHash });

    // In a future step, we will add email verification token generation
    // and send an email via EmailService.
    // For now, we proceed directly to token generation.
    
    const token = TokenService.generateAuthToken(newUser);

    return { user: newUser, token };
  }

  /**
   * Logs a user in with email and password.
   * @param {string} email - The user's email.
   * @param {string} password - The user's plaintext password.
   * @returns {Promise<{user: object, token: string}>} The user and a JWT.
   */
  static async login(email, password) {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      const error = new Error('Incorrect email or password.');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }
    
    if (!user.password_hash) {
       const error = new Error('Account was created with a social provider. Please use Google to sign in.');
       error.statusCode = 403;
       error.code = 'SOCIAL_ACCOUNT_LOGIN_ATTEMPT';
       throw error;
    }

    const isMatch = await PasswordService.comparePassword(password, user.password_hash);
    if (!isMatch) {
      const error = new Error('Incorrect email or password.');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }
    
    // In a future step, we will check if user.is_email_verified is true.

    const token = TokenService.generateAuthToken(user);
    
    return { user, token };
  }
}

module.exports = AuthService;
