// /backend/src/middleware/logger.middleware.js

import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';

const requestLogger = (req, res, next) => {
  const requestId = randomUUID();
  
  // Create a child logger with a bound requestId for this request context.
  const requestLog = logger.child({ requestId });
  req.log = requestLog;

  const start = Date.now();

  requestLog.info({
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    headers: req.headers,
  }, 'Incoming request');

  res.on('finish', () => {
    const duration = Date.now() - start;
    requestLog.info({
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      duration: `${duration}ms`,
    }, 'Request finished');
  });

  next();
};

export default requestLogger;
