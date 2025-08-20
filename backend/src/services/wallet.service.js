// /backend/src/services/wallet.service.js
const UserRepository = require('../repositories/user.repository');
const TransactionRepository = require('../repositories/transaction.repository');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

class WalletService {
  /**
   * Atomically credits gems to a user's account and creates a transaction log.
   * This operation is wrapped in a database transaction to ensure data integrity.
   * @param {string} userId - The user's ID (UUID).
   * @param {number} amount - The positive amount of gems to credit.
   * @param {object} transactionDetails - Details for the transaction log.
   * @param {string} transactionDetails.type - The type of transaction.
   * @param {string} [transactionDetails.description] - A user-facing description.
   * @param {string} [transactionDetails.referenceId] - An ID linking to another table.
   * @returns {Promise<void>}
   */
  static async credit(userId, amount, transactionDetails) {
    if (amount <= 0) {
      throw new Error('Credit amount must be positive.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: [updatedUser] } = await client.query(
        'UPDATE users SET gems = gems + $1 WHERE id = $2 RETURNING gems',
        [amount, userId]
      );

      const txData = { ...transactionDetails, userId, amountGems: amount };
      await TransactionRepository.create(txData, client);

      await client.query('COMMIT');
      logger.info({ userId, amount, newBalance: updatedUser.gems }, 'Successfully credited gems.');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ err: error, userId, amount }, 'Failed to credit gems. Transaction rolled back.');
      throw new Error('A database error occurred during the credit operation.');
    } finally {
      client.release();
    }
  }

  /**
   * Atomically debits gems from a user's account and creates a transaction log.
   * Checks for sufficient balance before proceeding.
   * This operation is wrapped in a database transaction.
   * @param {string} userId - The user's ID (UUID).
   * @param {number} amount - The positive amount of gems to debit.
   * @param {object} transactionDetails - Details for the transaction log.
   * @returns {Promise<void>}
   */
  static async debit(userId, amount, transactionDetails) {
    if (amount <= 0) {
      throw new Error('Debit amount must be positive.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the row and check the balance in one atomic operation
      const { rows: [user] } = await client.query(
        'SELECT gems FROM users WHERE id = $1 FOR UPDATE',
        [userId]
      );

      if (!user || user.gems < amount) {
        throw new Error('Insufficient gem balance.');
      }

      const { rows: [updatedUser] } = await client.query(
        'UPDATE users SET gems = gems - $1 WHERE id = $2 RETURNING gems',
        [amount, userId]
      );

      // Amount is stored as a negative number for debits in the ledger
      const txData = { ...transactionDetails, userId, amountGems: -amount };
      await TransactionRepository.create(txData, client);

      await client.query('COMMIT');
      logger.info({ userId, amount, newBalance: updatedUser.gems }, 'Successfully debited gems.');
    } catch (error) {
      await client.query('ROLLBACK');
      if (error.message === 'Insufficient gem balance.') {
        error.statusCode = 400;
        error.code = 'INSUFFICIENT_FUNDS';
      }
      logger.error({ err: error, userId, amount }, 'Failed to debit gems. Transaction rolled back.');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = WalletService;
