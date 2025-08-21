// backend/webSocketManager.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

let wss;
const clients = new Map(); // Map<userId, WebSocket>
let recentDuels = [];

const initializeWebSocket = (server) => {
    wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'auth' && data.token) {
                    const decoded = jwt.verify(data.token, process.env.JWT_SECRET);
                    const userId = decoded.userId;
                    clients.set(userId, ws);
                    ws.userId = userId;
                    
                    if (recentDuels.length > 0) {
                        ws.send(JSON.stringify({ type: 'live_feed_history', payload: recentDuels }));
                    }
                }
            } catch (err) {
                ws.terminate();
            }
        });

        ws.on('close', () => {
            if (ws.userId) {
                clients.delete(ws.userId);
            }
        });

        ws.on('error', (error) => {
            console.error('[WebSocket] An error occurred:', error);
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            ws.ping(() => {});
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });

    console.log('[WebSocket] Server initialized.');
    return wss;
};

const broadcast = (data) => {
    if (!wss) return;
    if (data.type === 'live_feed_update') {
        recentDuels.unshift(data.payload);
        if (recentDuels.length > 5) {
            recentDuels = recentDuels.slice(0, 5);
        }
    }
    const payload = JSON.stringify(data);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
};

const sendToUser = (userId, data) => {
    const client = clients.get(userId);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
        return true;
    }
    return false;
};

module.exports = {
    initializeWebSocket,
    broadcast,
    sendToUser,
};
