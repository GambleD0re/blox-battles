// /backend/src/middleware/errorHandler.js
const logger = require('../utils/logger');
const config = require('../config');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const errorMessage = err.isOperational ? err.message : 'An unexpected error occurred on the server.';

  // Log the detailed error for debugging
  logger.error(
    {
      err: {
        message: err.message,
        stack: err.stack,
        code: errorCode,
        isOperational: err.isOperational,
      },
      req: {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
      },
    },
    'Centralized error handler caught an error'
  );

  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
    },
  };

  // Include stack trace in development environment for easier debugging
  if (config.env === 'development') {
    errorResponse.error.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;
