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

module.exports = StripeService;
