// /backend/src/utils/logger.js

import pino from 'pino';
import pinoPretty from 'pino-pretty';

const isProduction = process.env.NODE_ENV === 'production';

const stream = isProduction ? process.stdout : pinoPretty({
  colorize: true,
  translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
  ignore: 'pid,hostname',
});

const logger = pino({
  level: isProduction ? 'info' : 'debug',
}, stream);

export default logger;
