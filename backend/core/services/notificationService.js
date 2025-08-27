// backend/core/services/notificationService.js
const { sendToUser } = require('../../webSocketManager');

/**
 * Sends a WebSocket message to a specific user to trigger an inbox refresh on their client.
 * @param {string | undefined | null} userId The UUID of the user to notify.
 */
const sendInboxRefresh = (userId) => {
    if (!userId) {
        return;
    }
    console.log(`[NotificationService] Sending inbox refresh request to user ${userId}`);
    sendToUser(userId, { type: 'inbox_refresh_request' });
};

module.exports = { sendInboxRefresh };
