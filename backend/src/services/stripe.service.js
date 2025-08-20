// /backend/src/services/stripe.service.js
const Stripe = require('stripe');
const config = require('../config');
const logger = require('../utils/logger');
const DepositRepository = require('../repositories/deposit.repository');
const WalletService = require('./wallet.service');

const stripe = new Stripe(config.stripe.secretKey);

class StripeService {
  /**
   * Creates a Stripe Checkout Session for a gem purchase.
   * @param {object} user - The authenticated user object.
   * @param {number} amountUSD - The amount in USD the user wants to spend.
   * @returns {Promise<Stripe.Checkout.Session>} The created Stripe session object.
   */
  static async createCheckoutSession(user, amountUSD) {
    // This value should come from the config service in a future step
    const USD_TO_GEMS_RATE = 100;
    const MINIMUM_USD_DEPOSIT = 4.00;

    if (amountUSD < MINIMUM_USD_DEPOSIT) {
      const error = new Error(`Minimum deposit amount is $${MINIMUM_USD_DEPOSIT.toFixed(2)}.`);
      error.statusCode = 400;
      error.code = 'DEPOSIT_TOO_LOW';
      throw error;
    }

    const gemAmount = Math.floor(amountUSD * USD_TO_GEMS_RATE);
    const amountInCents = Math.round(amountUSD * 100);

    try {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${gemAmount.toLocaleString()} Gems`,
              description: `Digital currency for ${config.brand.shortName}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        }],
        mode: 'payment',
        metadata: {
          userId: user.userId,
          gemAmount: gemAmount,
        },
        success_url: `${config.frontendUrl}/deposit?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.frontendUrl}/deposit?canceled=true`,
      });
      return session;
    } catch (error) {
      logger.error({ err: error }, 'Failed to create Stripe Checkout session.');
      throw new Error('Could not create payment session.');
    }
  }

  /**
   * Handles the 'checkout.session.completed' webhook event from Stripe.
   * @param {object} session - The Stripe session object from the webhook event.
   * @returns {Promise<void>}
   */
  static async handleSuccessfulPayment(session) {
    const { userId, gemAmount } = session.metadata;
    const sessionId = session.id;

    const existingPurchase = await DepositRepository.findStripePurchaseBySessionId(sessionId);
    if (existingPurchase) {
      logger.warn({ sessionId }, 'Received duplicate Stripe webhook for a session already processed. Ignoring.');
      return;
    }

    const gemAmountInt = parseInt(gemAmount, 10);
    if (!userId || !gemAmountInt || gemAmountInt <= 0) {
      logger.error({ metadata: session.metadata }, 'Stripe webhook received with invalid metadata.');
      throw new Error('Invalid metadata in Stripe session.');
    }

    await WalletService.credit(userId, gemAmountInt, {
      type: 'deposit_stripe',
      description: `${gemAmountInt.toLocaleString()} Gems purchased via Card`,
      referenceId: sessionId,
    });
    
    await DepositRepository.createStripePurchase({
        userId,
        stripeSessionId: sessionId,
        gemAmount: gemAmountInt,
        amountPaid: session.amount_total,
        currency: session.currency
    });

    logger.info({ userId, gemAmount, sessionId }, 'Successfully processed Stripe payment and credited gems.');
  }
}

module.exports = StripeService;```

---
**File 3 of 3**
```javascript
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
