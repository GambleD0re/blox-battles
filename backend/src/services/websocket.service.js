// /backend/src/services/websocket.service.js
const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

class WebSocketManager {
  constructor(server) {
    if (WebSocketManager.instance) {
      return WebSocketManager.instance;
    }

    this.wss = new WebSocketServer({ server });
    this.clients = new Map(); // Map<userId, WebSocket>
    this.recentDuels = []; // Cache for live feed history

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeatInterval();
    
    logger.info('WebSocketManager initialized.');
    WebSocketManager.instance = this;
  }

  handleConnection(ws) {
    logger.debug('WebSocket client connected. Awaiting authentication.');
    ws.isAlive = true;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'auth' && data.token) {
          this.authenticateClient(ws, data.token);
        }
      } catch (err) {
        logger.warn({ err }, 'Invalid WebSocket message received.');
        ws.terminate();
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        this.clients.delete(ws.userId);
        logger.info({ userId: ws.userId, totalClients: this.clients.size }, 'Authenticated client disconnected.');
      } else {
        logger.debug('Unauthenticated client disconnected.');
      }
    });

    ws.on('error', (error) => {
      logger.error({ err: error }, 'A WebSocket error occurred.');
    });
  }

  authenticateClient(ws, token) {
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      const userId = decoded.userId;

      // If another connection for this user exists, terminate it.
      if (this.clients.has(userId)) {
        logger.warn({ userId }, 'New WebSocket connection established for user with an existing one. Terminating old connection.');
        this.clients.get(userId).terminate();
      }

      ws.userId = userId;
      this.clients.set(userId, ws);
      logger.info({ userId, totalClients: this.clients.size }, 'WebSocket client authenticated.');

      // Send recent history upon successful authentication
      if (this.recentDuels.length > 0) {
        this.sendToUser(userId, { type: 'live_feed_history', payload: this.recentDuels });
      }
    } catch (err) {
      logger.warn({ err }, 'WebSocket authentication failed.');
      ws.terminate();
    }
  }

  startHeartbeatInterval() {
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.debug({ userId: ws.userId }, 'Terminating stale WebSocket connection.');
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  /**
   * Sends a message to all connected and authenticated clients.
   * @param {object} data - The data payload to broadcast.
   */
  broadcast(data) {
    if (data.type === 'live_feed_update') {
      this.recentDuels.unshift(data.payload);
      // Keep only the last 5 duel results in history
      if (this.recentDuels.length > 5) {
        this.recentDuels.pop();
      }
    }
    const payload = JSON.stringify(data);
    this.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(payload);
      }
    });
  }

  /**
   * Sends a message to a specific user.
   * @param {string} userId - The UUID of the target user.
   * @param {object} data - The data payload to send.
   * @returns {boolean} True if the message was sent, false otherwise.
   */
  sendToUser(userId, data) {
    const client = this.clients.get(userId);
    if (client && client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(data));
      logger.debug({ userId, type: data.type }, 'Sent targeted WebSocket message.');
      return true;
    }
    logger.warn({ userId, type: data.type }, 'Could not send targeted message: user not connected.');
    return false;
  }
}

// Export a singleton instance
let instance;
module.exports = (server) => {
  if (!instance && server) {
    instance = new WebSocketManager(server);
  }
  return instance;
};
