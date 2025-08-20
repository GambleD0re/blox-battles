// /backend/src/middleware/validator.js
const { validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const firstError = errors.array({ onlyFirstError: true })[0];
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: firstError.msg,
        field: firstError.path,
      },
    });
  }
  next();
};

module.exports = {
  handleValidationErrors,
};
