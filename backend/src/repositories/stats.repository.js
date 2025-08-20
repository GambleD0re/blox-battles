// /backend/src/repositories/stats.repository.js
const { query } = require('../config/database');

class StatsRepository {
  /**
   * Fetches aggregated statistics for the entire platform.
   * @returns {Promise<object>} An object containing various platform stats.
   */
  static async getPlatformStats() {
    const queries = [
      query("SELECT COUNT(id)::int FROM users WHERE status != 'terminated' AS total_users;"),
      query("SELECT SUM(gems)::bigint FROM users AS gems_in_circulation;"),
      query("SELECT COUNT(id)::int FROM disputes WHERE status = 'pending' AS pending_disputes;"), // Note: will be deprecated
      query("SELECT COUNT(id)::int FROM payout_requests WHERE status = 'awaiting_approval' AS pending_payouts;"),
      query("SELECT SUM(tax_collected)::bigint FROM duels AS total_tax_collected;"),
    ];

    const results = await Promise.all(queries);

    const stats = {
      totalUsers: results[0].rows[0].total_users || 0,
      gemsInCirculation: results[1].rows[0].gems_in_circulation || 0,
      pendingDisputes: results[2].rows[0].pending_disputes || 0,
      pendingPayouts: results[3].rows[0].pending_payouts || 0,
      taxCollected: results[4].rows[0].total_tax_collected || 0,
    };
    
    return stats;
  }
}

module.exports = StatsRepository;
