// /backend/src/api/routes/health.routes.js

import { Router } from 'express';

const router = Router();

/**
 * @route GET /healthz
 * @description Checks the health of the API.
 * @access Public
 */
router.get('/healthz', (req, res) => {
  // This will be expanded later to check database and cache connections.
  const healthCheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    status: 'healthy',
  };
  res.status(200).json(healthCheck);
});

export default router;
