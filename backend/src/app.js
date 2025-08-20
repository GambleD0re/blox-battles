// /backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mainApiRouter = require('./api');
const config = require('./config');
const PaymentController = require('./controllers/payment.controller');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// --- Global Middleware ---
app.use(helmet());

const corsOptions = {
  origin: config.frontendUrl,
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// --- Health Check Route ---
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'CyberDome Backend is healthy' });
});

// --- Stripe Webhook Route ---
// This route must be defined BEFORE express.json() to receive the raw body
app.post(
  '/api/v1/stripe/webhook',
  express.raw({ type: 'application/json' }),
  PaymentController.handleStripeWebhook
);

// Apply the global JSON parser for all other routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// --- API Routes ---
// Mount the main API router which contains all versioned routes
app.use('/api', mainApiRouter);

// --- Centralized Error Handler ---
// This must be the last piece of middleware
app.use(errorHandler);


module.exports = app;
