// /backend/src/middleware/validator.middleware.js

import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

/**
 * Middleware to handle the results of express-validator checks.
 * If validation errors exist, it throws a standardized ApiError.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(err => err.msg);
    // Join multiple error messages for a more informative response.
    const combinedMessage = errorMessages.join(', ');
    
    throw new ApiError(400, 'VALIDATION_ERROR', combinedMessage);
  }
  next();
};

export default handleValidationErrors;
