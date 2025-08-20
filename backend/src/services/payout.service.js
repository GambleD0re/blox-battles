// /backend/src/services/payout.service.js
const PayoutRepository = require('../repositories/payout.repository');
const WalletService = require('./wallet.service');
const logger = require('../utils/logger');

class PayoutService {
  /**
   * Creates a crypto withdrawal request, debiting gems from the user's account.
   * @param {string} userId - The ID of the user requesting the payout.
   * @param {object} requestData - The details of the withdrawal request.
   * @param {number} requestData.gemAmount - The number of gems to withdraw.
   * @param {string} requestData.recipientAddress - The destination crypto address.
   * @param {string} requestData.tokenType - The type of token (e.g., 'USDC').
   * @returns {Promise<object>} The newly created payout request record.
   */
  static async requestCryptoPayout(userId, requestData) {
    const { gemAmount, recipientAddress, tokenType } = requestData;

    // This value should come from the config service later
    const GEM_TO_USD_CONVERSION_RATE = 110;
    const MINIMUM_GEM_WITHDRAWAL = 11;

    if (gemAmount < MINIMUM_GEM_WITHDRAWAL) {
      const error = new Error(`Minimum withdrawal is ${MINIMUM_GEM_WITHDRAWAL} gems.`);
      error.statusCode = 400;
      error.code = 'WITHDRAWAL_TOO_LOW';
      throw error;
    }

    // This transaction will either fully succeed or fully fail.
    // The WalletService.debit method handles the transaction internally.
    await WalletService.debit(userId, gemAmount, {
      type: 'withdrawal_pending',
      description: `Withdrawal request for ${gemAmount.toLocaleString()} gems to ${recipientAddress}.`,
    });

    try {
      const amountUsd = gemAmount / GEM_TO_USD_CONVERSION_RATE;
      const newRequest = await PayoutRepository.create({
        userId,
        type: 'crypto',
        provider: 'direct_node', // As we plan to use our own node
        amountGems: gemAmount,
        amountUsd,
        destinationAddress: recipientAddress,
      });

      logger.info({ userId, requestId: newRequest.id, gemAmount }, 'Crypto payout request created successfully.');
      return newRequest;
    } catch (error) {
      // If creating the payout record fails, we must refund the user.
      logger.error({ err: error, userId, gemAmount }, 'Failed to create payout record after debit. Refunding user.');
      
      await WalletService.credit(userId, gemAmount, {
        type: 'withdrawal_refund',
        description: `Refund for failed withdrawal request.`,
      });

      throw new Error('Could not create your withdrawal request at this time. Your gems have been refunded.');
    }
  }
}

module.exports = PayoutService;
