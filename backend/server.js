// /backend/server.js
// This MUST be the first line of code to register the module alias
require('module-alias/register');

require('dotenv').config();

const http = require('http');
const app = require('@/app');
const logger = require('@/utils/logger');
const { pool } = require('@/config/database');

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

const startServer = async () => {
  try {
    logger.info('Attempting to connect to the database...');
    const client = await pool.connect();
    logger.info('Database connection established successfully.');
    client.release();

    server.listen(PORT, () => {
      logger.info(`Blox Battles Backend Server started. Listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to the database. Shutting down.');
    process.exit(1);
  }
};

startServer();
