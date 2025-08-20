// /backend/src/middleware/errorHandler.middleware.js

import logger from '../utils/logger.js';
import ApiError from '../utils/ApiError.js';
import config from '../config/environment.js';

/**
 * Centralized Express error handling middleware.
 * This should be the last middleware added to the app.
 */
const centralErrorHandler = (err, req, res, next) => {
  let error = err;

  // If the error is not one of our operational ApiErrors, it's an unexpected error.
  // We should log it and convert it to a generic ApiError to avoid leaking details.
  if (!(error instanceof ApiError)) {
    logger.error(error, 'An unexpected error occurred');
    error = new ApiError(500, 'INTERNAL_SERVER_ERROR', 'Something went wrong on our end.');
  }

  const errorResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };

  // Do not include the stack trace in production responses for security reasons.
  if (!config.isProduction) {
    errorResponse.stack = error.stack;
  }

  res.status(error.statusCode).json(errorResponse);
};

export default centralErrorHandler;
