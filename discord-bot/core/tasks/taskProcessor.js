// discord-bot/core/tasks/taskProcessor.js
const { apiClient } = require('../utils/apiClient');
const { handleCreateTicketChannel, handleCloseTicket } = require('./ticketTasks');
const { handleDuelResult, handleDmNotification } = require('./duelTasks');
const { handleServerStatusUpdate } = require('./serverStatusTasks'); // [NEW] Import the new handler

const TASK_FETCH_INTERVAL_MS = (process.env.UPDATE_INTERVAL_SECONDS ? parseInt(process.env.UPDATE_INTERVAL_SECONDS, 10) : 15) * 1000;

const taskHandlers = {
    'CREATE_TICKET_CHANNEL': handleCreateTicketChannel,
    'CLOSE_TICKET': handleCloseTicket,
    'POST_DUEL_RESULT_TO_DISCORD': handleDuelResult,
    'SEND_DISCORD_LINK_SUCCESS_DM': (client, task) => handleDmNotification(client, task, 'link_success'),
    'SEND_DUEL_CHALLENGE_DM': (client, task) => handleDmNotification(client, task, 'duel_challenge'),
    'SEND_DUEL_ACCEPTED_DM': (client, task) => handleDmNotification(client, task, 'duel_accepted'),
    'SEND_DUEL_STARTED_DM': (client, task) => handleDmNotification(client, task, 'duel_started'),
    'ANNOUNCE_SERVER_STATUS': handleServerStatusUpdate, // [NEW] Register the new handler
};

async function processTasks(client) {
    try {
        const response = await apiClient.get('/tasks/bot/discord');
        const tasks = response.data;
        if (tasks.length > 0) {
            console.log(`[TASKS] Fetched ${tasks.length} tasks to process.`);
        }

        for (const task of tasks) {
            const handler = taskHandlers[task.task_type];
            if (handler) {
                try {
                    await handler(client, task);
                    await apiClient.post(`/tasks/${task.id}/complete`);
                    console.log(`[TASKS] Successfully processed and completed task ${task.id} (${task.task_type}).`);
                } catch (taskError) {
                    console.error(`[TASKS] Error processing task ${task.id} (${task.task_type}):`, taskError.message);
                }
            } else {
                console.warn(`[TASKS] No handler found for task type: ${task.task_type}`);
            }
        }
    } catch (err) {
        const errorMessage = err.response ? `${err.response.status} - ${JSON.stringify(err.response.data)}` : err.message;
        console.error(`[TASKS] API Error fetching tasks: ${errorMessage}`);
    }
}

function startTaskProcessor(client) {
    console.log(`[TASKS] Task processor starting. Fetching every ${TASK_FETCH_INTERVAL_MS / 1000} seconds.`);
    processTasks(client);
    setInterval(() => processTasks(client), TASK_FETCH_INTERVAL_MS);
}

module.exports = { startTaskProcessor };
