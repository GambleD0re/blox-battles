// /backend/src/repositories/transaction.repository.js
const { query } = require('../config/database');

class TransactionRepository {
  /**
   * Creates a new transaction record in the history ledger.
   * This is the canonical log for all gem movements.
   * @param {object} txData - The transaction data.
   * @param {string} txData.userId - The user's ID (UUID).
   * @param {string} txData.type - The type of transaction (e.g., 'deposit_stripe', 'duel_wager').
   * @param {number} txData.amountGems - The amount of gems (can be negative).
   * @param {string} [txData.description] - A user-facing description of the transaction.
   * @param {string} [txData.referenceId] - An ID linking to another table (e.g., duel_id, payout_id).
   * @param {object} [client=query] - Optional database client for transactions.
   * @returns {Promise<object>} The created transaction log entry.
   */
  static async create({ userId, type, amountGems, description, referenceId }, client = query) {
    const text = `
      INSERT INTO transaction_history 
        (user_id, type, amount_gems, description, reference_id)
      VALUES 
        ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [userId, type, amountGems, description, referenceId];
    const { rows } = await client.query(text, values);
    return rows[0];
  }

  /**
   * Finds all transaction history for a given user, newest first.
   * @param {string} userId - The user's ID (UUID).
   * @param {number} [limit=100] - The maximum number of transactions to return.
   * @returns {Promise<Array<object>>} A list of the user's transactions.
   */
  static async findByUserId(userId, limit = 100) {
    const text = `
      SELECT id, type, amount_gems, description, reference_id, created_at
      FROM transaction_history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `;
    const values = [userId, limit];
    const { rows } = await query(text, values);
    return rows;
  }
}

module.exports = TransactionRepository;
