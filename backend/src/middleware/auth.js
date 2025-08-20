// /backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Access token is missing or invalid.',
      },
    });
  }

  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      logger.warn({ err }, 'JWT verification failed');
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Token is invalid or has expired.',
        },
      });
    }
    req.user = user;
    next();
  });
};

const authenticateBot = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== config.apiKeys.bot) {
    logger.warn({ ip: req.ip, apiKeyAttempt: apiKey }, 'Unauthorized bot access attempt');
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API key.',
      },
    });
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Requires administrator privileges.',
    },
  });
};

const isMasterAdmin = (req, res, next) => {
  if (req.user && req.user.isMasterAdmin) {
    return next();
  }
  return res.status(403).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Requires master administrator privileges.',
    },
  });
};


module.exports = {
  authenticateToken,
  authenticateBot,
  isAdmin,
  isMasterAdmin,
};
