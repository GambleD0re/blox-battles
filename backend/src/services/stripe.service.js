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
   * @param {object} user - The authenticated user object containing at least a userId.
   * @param {number} amountUSD - The amount in USD the user wants to spend.
   * @returns {Promise<Stripe.Checkout.Session>} The created Stripe session object.
   */
  static async createCheckoutSession(user, amountUSD) {
    const USD_TO_GEMS_RATE = 100; // This should come from config service later
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
        customer_email: user.email,
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
   * Constructs and verifies a Stripe webhook event from a raw request.
   * @param {Buffer} body - The raw request body from Stripe.
   * @param {string} signature - The value of the 'stripe-signature' header.
   * @returns {Stripe.Event} The verified Stripe event object.
   */
  static constructWebhookEvent(body, signature) {
    try {
      return stripe.webhooks.constructEvent(body, signature, config.stripe.webhookSecret);
    } catch (err) {
      logger.error({ err }, 'Stripe webhook signature verification failed.');
      const error = new Error(`Webhook Error: ${err.message}`);
      error.statusCode = 400;
      error.code = 'STRIPE_WEBHOOK_VALIDATION_FAILED';
      throw error;
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

    const purchaseData = {
      userId,
      stripeSessionId: sessionId,
      gemAmount: gemAmountInt,
      amountPaid: session.amount_total,
      currency: session.currency,
    };
    
    const transactionDetails = {
      type: 'deposit_stripe',
      description: `${gemAmountInt.toLocaleString()} Gems purchased via Card`,
      referenceId: sessionId,
    };

    // Use a transaction to credit gems and record the purchase atomically
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await WalletService.credit(userId, gemAmountInt, transactionDetails, client);
      await DepositRepository.createStripePurchase(purchaseData, client);
      await client.query('COMMIT');
      logger.info({ userId, gemAmount, sessionId }, 'Successfully processed Stripe payment and credited gems.');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error({ err: error, sessionId }, 'Transaction failed during Stripe webhook processing. Rolled back.');
      throw error; // Re-throw to signal failure to the webhook handler
    } finally {
      client.release();
    }
  }
}

module.exports = StripeService;
