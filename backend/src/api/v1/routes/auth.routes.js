// /backend/src/api/v1/routes/auth.routes.js
const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../../../controllers/auth.controller');
const { handleValidationErrors } = require('../../../middleware/validator');

const router = express.Router();

router.post(
  '/register',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address.')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long.')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter.')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter.')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number.')
      .matches(/[\W_]/)
      .withMessage('Password must contain at least one special character.'),
  ],
  handleValidationErrors,
  AuthController.register
);

router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please enter a valid email address.')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password cannot be empty.'),
  ],
  handleValidationErrors,
  AuthController.login
);

module.exports = router;
