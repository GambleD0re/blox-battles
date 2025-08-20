// /backend/server.js
require('dotenv').config();

const http = require('http');
const app = require('./src/app');
const logger = require('./src/utils/logger');
const { pool } = require('./src/config/database');

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

const startServer = async () => {
  try {
    logger.info('Attempting to connect to the database...');
    const client = await pool.connect();
    logger.info('Database connection established successfully.');
    client.release();

    server.listen(PORT, () => {
      logger.info(`CyberDome Backend Server started. Listening on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to connect to the database. Shutting down.');
    process.exit(1);
  }
};

startServer();
