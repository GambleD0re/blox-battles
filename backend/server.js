// /backend/server.js

import http from 'http';
import 'dotenv/config';

import app from './src/app.js';
import logger from './src/utils/logger.js';
// import { initializeWebSocket } from './src/services/websocket.service.js'; // To be added later

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

// initializeWebSocket(server); // WebSocket initialization will be activated later

const startServer = () => {
  server.listen(PORT, () => {
    logger.info(`CyberDome Backend listening on port ${PORT}`);
  });
};

const handleShutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully.`);
  server.close(() => {
    logger.info('HTTP server closed.');
    // Add any other cleanup logic here (e.g., close database connections)
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

startServer();
