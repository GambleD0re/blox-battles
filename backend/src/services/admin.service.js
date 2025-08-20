// /backend/src/services/admin.service.js
const UserRepository = require('../repositories/user.repository');
const StatsRepository = require('../repositories/stats.repository');
const WalletService = require('./wallet.service');
const logger = require('../utils/logger');

class AdminService {
  /**
   * Retrieves platform-wide statistics for the admin dashboard.
   * @returns {Promise<object>} The platform statistics.
   */
  static async getDashboardStats() {
    return StatsRepository.getPlatformStats();
  }

  /**
   * Searches for users based on administrative criteria.
   * @param {object} filters - The search and filter criteria.
   * @returns {Promise<Array<object>>} A list of users.
   */
  static async findUsers(filters) {
    return UserRepository.searchAndFilter(filters);
  }

  /**
   * Bans a user.
   * @param {string} userId - The ID of the user to ban.
   * @param {string} reason - The reason for the ban.
   * @param {number|null} durationHours - The duration of the ban in hours. Null for permanent.
   * @returns {Promise<object>} The updated user object.
   */
  static async banUser(userId, reason, durationHours) {
    if (!reason) {
      const error = new Error('A reason is required to ban a user.');
      error.statusCode = 400;
      error.code = 'BAN_REASON_REQUIRED';
      throw error;
    }

    const expiresAt = durationHours 
      ? new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString()
      : null;

    const updatedUser = await UserRepository.updateStatus(userId, {
      status: 'banned',
      reason,
      expiresAt,
    });
    
    logger.info({ admin: 'system', targetUser: userId, reason }, 'User has been banned.');
    // In a future step, this service would also cancel their pending duels, etc.

    return updatedUser;
  }

  /**
   * Unbans a user.
   * @param {string} userId - The ID of the user to unban.
   * @returns {Promise<object>} The updated user object.
   */
  static async unbanUser(userId) {
    const updatedUser = await UserRepository.updateStatus(userId, {
      status: 'active',
      reason: null,
      expiresAt: null,
    });
    
    logger.info({ admin: 'system', targetUser: userId }, 'User has been unbanned.');
    return updatedUser;
  }

  /**
   * Adjusts a user's gem balance.
   * @param {string} userId - The ID of the user to adjust.
   * @param {number} amount - The amount to add (positive) or remove (negative).
   * @returns {Promise<void>}
   */
  static async adjustUserGems(userId, amount) {
    if (amount === 0) return;

    const transactionDetails = {
      type: 'admin_adjustment',
      description: `Admin adjustment of ${amount} gems.`,
    };

    if (amount > 0) {
      await WalletService.credit(userId, amount, transactionDetails);
    } else {
      await WalletService.debit(userId, -amount, transactionDetails);
    }
  }
}

module.exports = AdminService;
