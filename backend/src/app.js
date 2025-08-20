// /backend/src/app.js

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config/environment.js';
import requestLogger from './middleware/logger.middleware.js';
// import masterRouter from './api/routes/index.js'; // To be added later
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

// 4. API routes (to be mounted later)
// app.use('/api/v1', masterRouter);

// Simple root route for basic status check
app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'CyberDome API is running.' });
});

// 5. 404 Not Found handler (for routes not matched)
app.use((req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
});

// 6. Centralized error handler (to be added later)
// app.use(centralErrorHandler);

export default app;
