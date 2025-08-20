// /backend/src/utils/ApiError.js

/**
 * Custom Error class for creating standardized API errors throughout the application.
 * @class ApiError
 * @extends {Error}
 */
class ApiError extends Error {
  /**
   * Creates an instance of ApiError.
   * @param {number} statusCode - The HTTP status code for the response.
   * @param {string} code - A short, machine-readable error code (e.g., 'VALIDATION_ERROR').
   * @param {string} message - A user-friendly message explaining the error.
   * @param {boolean} [isOperational=true] - Indicates if this is a known, operational error (vs. a programming error).
   */
  constructor(statusCode, code, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    
    // Capture the stack trace, excluding the constructor call from it.
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
