// discord-bot/core/utils/statusCache.js
const { apiClient } = require('./apiClient');

const statusCache = {
    commands: new Map(),
    ticketTypes: new Map()
};

const cacheStatuses = async () => {
    try {
        const { data } = await apiClient.get('/admin/feature-status');
        
        // Clear and update command statuses
        statusCache.commands.clear();
        data.commands.forEach(cmd => statusCache.commands.set(cmd.command_name, cmd.is_enabled));
        console.log(`[StatusCache] Cached ${statusCache.commands.size} command statuses.`);

        // Clear and update ticket type statuses
        statusCache.ticketTypes.clear();
        data.ticketTypes.forEach(type => statusCache.ticketTypes.set(type.type_name, type.is_enabled));
        console.log(`[StatusCache] Cached ${statusCache.ticketTypes.size} ticket type statuses.`);

    } catch (error) {
        console.error('[StatusCache] Failed to fetch and cache feature statuses:', error.response?.data?.message || error.message);
    }
};

const isCommandEnabled = (commandName) => {
    // Default to enabled if not found in cache (fail open)
    return statusCache.commands.has(commandName) ? statusCache.commands.get(commandName) : true;
};

const getEnabledTicketTypes = () => {
    const enabledTypes = [];
    for (const [type, isEnabled] of statusCache.ticketTypes.entries()) {
        if (isEnabled) {
            enabledTypes.push(type);
        }
    }
    return enabledTypes;
};

module.exports = {
    cacheStatuses,
    isCommandEnabled,
    getEnabledTicketTypes
};
