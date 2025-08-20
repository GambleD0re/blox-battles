// /backend/src/repositories/payout.repository.js
const { query } = require('../config/database');
const crypto = require('crypto');

class PayoutRepository {
  /**
   * Creates a new payout request.
   * @param {object} requestData - The payout request details.
   * @param {string} requestData.userId - The user's ID (UUID).
   * @param {string} requestData.type - The payout type (e.g., 'crypto').
   * @param {string} requestData.provider - The payout provider (e.g., 'direct_node').
   * @param {number} requestData.amountGems - The amount of gems to withdraw.
   * @param {number} requestData.amountUsd - The equivalent USD value.
   * @param {string} requestData.destinationAddress - The recipient's wallet address.
   * @param {object} [client=query] - Optional database client for transactions.
   * @returns {Promise<object>} The created payout request.
   */
  static async create({ userId, type, provider, amountGems, amountUsd, destinationAddress }, client = query) {
    const id = crypto.randomUUID();
    const text = `
      INSERT INTO payout_requests
        (id, user_id, type, provider, amount_gems, amount_usd, fee_usd, destination_address, status)
      VALUES
        ($1, $2, $3, $4, $5, $6, 0, $7, 'awaiting_approval')
      RETURNING *;
    `;
    const values = [id, userId, type, provider, amountGems, amountUsd, destinationAddress];
    const { rows } = await client.query(text, values);
    return rows[0];
  }

  /**
   * Finds a payout request by its unique ID.
   * @param {string} id - The UUID of the payout request.
   * @returns {Promise<object|null>} The request object or null.
   */
  static async findById(id) {
    const text = 'SELECT * FROM payout_requests WHERE id = $1';
    const values = [id];
    const { rows } = await query(text, values);
    return rows[0] || null;
  }

  /**
   * Updates the status of a payout request.
   * @param {string} id - The UUID of the payout request.
   * @param {string} status - The new status.
   * @param {object} [options] - Optional data like decline reason.
   * @param {string} [options.declineReason] - Reason for declining.
   * @returns {Promise<object>} The updated payout request.
   */
  static async updateStatus(id, status, options = {}) {
    const { declineReason } = options;
    const text = `
      UPDATE payout_requests
      SET 
        status = $1,
        decline_reason = COALESCE($2, decline_reason),
        updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const values = [status, declineReason, id];
    const { rows } = await query(text, values);
    return rows[0];
  }
}

module.exports = PayoutRepository;
