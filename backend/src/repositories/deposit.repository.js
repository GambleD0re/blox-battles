// /backend/src/repositories/deposit.repository.js
const { query } = require('../config/database');

class DepositRepository {
  /**
   * Creates a record for a Stripe gem purchase.
   * @param {object} purchaseData - The Stripe purchase details.
   * @param {string} purchaseData.userId - The user's ID (UUID).
   * @param {string} purchaseData.stripeSessionId - The unique Stripe session ID.
   * @param {number} purchaseData.gemAmount - The amount of gems purchased.
   * @param {number} purchaseData.amountPaid - The amount paid in cents.
   * @param {string} purchaseData.currency - The currency code (e.g., 'usd').
   * @param {object} [client=query] - Optional database client for transactions.
   * @returns {Promise<object>} The created gem purchase record.
   */
  static async createStripePurchase({ userId, stripeSessionId, gemAmount, amountPaid, currency }, client = query) {
    const text = `
      INSERT INTO gem_purchases 
        (user_id, stripe_session_id, gem_amount, amount_paid, currency, status)
      VALUES 
        ($1, $2, $3, $4, $5, 'completed')
      RETURNING *;
    `;
    const values = [userId, stripeSessionId, gemAmount, amountPaid, currency];
    const { rows } = await client.query(text, values);
    return rows[0];
  }

  /**
   * Finds a Stripe purchase by its unique session ID to prevent duplicates.
   * @param {string} stripeSessionId - The Stripe session ID.
   * @returns {Promise<object|null>} The purchase record or null.
   */
  static async findStripePurchaseBySessionId(stripeSessionId) {
    const text = 'SELECT id FROM gem_purchases WHERE stripe_session_id = $1';
    const values = [stripeSessionId];
    const { rows } = await query(text, values);
    return rows[0] || null;
  }

  /**
   * Creates a pending record for a detected crypto deposit.
   * @param {object} depositData - The crypto deposit details.
   * @returns {Promise<object>} The created crypto deposit record.
   */
  static async createCryptoDeposit({ userId, txHash, network, tokenType, amountCrypto }) {
    const text = `
      INSERT INTO crypto_deposits
        (user_id, tx_hash, network, token_type, amount_crypto, gem_amount, status)
      VALUES 
        ($1, $2, $3, $4, $5, 0, 'pending')
      ON CONFLICT (tx_hash, network) DO NOTHING
      RETURNING *;
    `;
    const values = [userId, txHash, network, tokenType, amountCrypto];
    const { rows } = await query(text, values);
    return rows[0];
  }

  /**
   * Finds all crypto deposits with a 'pending' status.
   * @returns {Promise<Array<object>>} A list of pending crypto deposits.
   */
  static async findPendingCryptoDeposits() {
    const text = "SELECT * FROM crypto_deposits WHERE status = 'pending'";
    const { rows } = await query(text);
    return rows;
  }
}

module.exports = DepositRepository;
