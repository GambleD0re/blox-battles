// /backend/src/app.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from '../config/environment.js';
import requestLogger from '../middleware/logger.middleware.js';
import masterRouter from './api/routes/index.js';
// import centralErrorHandler from './middleware/errorHandler.middleware.js'; // To be added later

const app = express();

// 1. Apply essential security middleware
app.use(helmet());
app.use(cors({
  origin: config.serverUrl,
  credentials: true,
}));

// 2. Apply global rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// 3. Apply body parser and logger
app.use(express.json({ limit: '10kb' })); // Limit request body size
app.use(requestLogger);

// 4. Mount the master API router with versioning
app.use('/api/v1', masterRouter);

// Simple root route for basic status check
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'CyberDome API is running.' });
});

// 5. 404 Not Found handler for routes not matched by the master router
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.status = 404; // Add a status property to the error
  next(error);
});

// 6. Centralized error handler (to be fully implemented later)
// For now, a simple one to handle the 404 case.
app.use((err, req, res, next) => {
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    message: err.message,
    stack: config.isProduction ? '🥞' : err.stack, // Only show stack in development
  });
});

export default app;
