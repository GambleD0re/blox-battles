// /backend/src/controllers/payment.controller.js
const StripeService = require('../services/stripe.service');
const PayoutService = require('../services/payout.service');

class PaymentController {
  static async createStripeCheckoutSession(req, res, next) {
    try {
      const user = req.user; // Contains { userId, email, ... } from JWT
      const { amount } = req.body;
      const session = await StripeService.createCheckoutSession(user, amount);
      res.status(200).json({
        success: true,
        data: {
          sessionId: session.id,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async handleStripeWebhook(req, res, next) {
    const signature = req.headers['stripe-signature'];
    try {
      const event = StripeService.constructWebhookEvent(req.body, signature);

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        await StripeService.handleSuccessfulPayment(session);
      }
      
      res.status(200).json({ success: true, received: true });
    } catch (error) {
      // The error handler will catch this and respond appropriately
      next(error);
    }
  }

  static async requestPayout(req, res, next) {
    try {
      const userId = req.user.userId;
      const payoutRequestData = {
        gemAmount: req.body.gemAmount,
        recipientAddress: req.body.recipientAddress,
        tokenType: req.body.tokenType,
      };

      const newRequest = await PayoutService.requestCryptoPayout(userId, payoutRequestData);
      
      res.status(201).json({
        success: true,
        data: newRequest,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = PaymentController;
