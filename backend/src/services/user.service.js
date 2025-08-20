// /backend/src/services/user.service.js
const UserRepository = require('../repositories/user.repository');

class UserService {
  /**
   * Retrieves a user's public-facing profile data.
   * Excludes sensitive information like password hashes.
   * @param {string} userId - The UUID of the user.
   * @returns {Promise<object>} The user's profile data.
   */
  static async getUserProfile(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      error.code = 'USER_NOT_FOUND';
      throw error;
    }

    // Explicitly destructure to create a safe data transfer object (DTO)
    // This prevents accidental leakage of sensitive fields like password_hash.
    const {
      id,
      email,
      user_handle,
      display_name,
      avatar_url,
      gems,
      wins,
      losses,
      is_admin,
      is_master_admin,
      created_at,
      is_email_verified,
      status
    } = user;

    return {
      id,
      email,
      user_handle,
      display_name,
      avatar_url,
      gems,
      wins,
      losses,
      isAdmin: is_admin,
      isMasterAdmin: is_master_admin,
      createdAt: created_at,
      isEmailVerified: is_email_verified,
      status
    };
  }
}

module.exports = UserService;
