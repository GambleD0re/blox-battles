// discord-bot/deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { cacheActiveGamesList, getGameChoices } = require('./core/utils/gameData');

const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
    console.error("FATAL: Missing required Discord environment variables for command deployment.");
    process.exit(1);
}

// --- Main Deployment Logic ---
(async () => {
    try {
        // Step 1: Fetch and cache the list of active games from the backend API FIRST.
        // This ensures that when the command files are loaded, getGameChoices() has data.
        console.log('[DEPLOY] Fetching active games list for command choices...');
        await cacheActiveGamesList();
        const gameChoices = getGameChoices();
        if (gameChoices.length === 0) {
            console.warn('[DEPLOY] WARNING: No active games were fetched from the API. Commands will have no game choices.');
        } else {
            console.log(`[DEPLOY] Successfully fetched ${gameChoices.length} games: ${gameChoices.map(g => g.name).join(', ')}`);
        }

        // Step 2: Now that game data is cached, load the command files.
        const commands = [];
        const commandsPath = path.join(__dirname, 'core', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const filePath = path.join(commandsPath, file);
            // By requiring the file here, it will use the already-populated game cache.
            const command = require(filePath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.warn(`[DEPLOY] Command at ${filePath} is invalid.`);
            }
        }

        // Step 3: Register the commands with Discord as usual.
        const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

        console.log(`[DEPLOY] Started refreshing ${commands.length} application (/) commands for guild ${DISCORD_GUILD_ID}.`);
        
        const data = await rest.put(
            Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
            { body: commands },
        );

        console.log(`[DEPLOY] Successfully reloaded ${data.length} application (/) commands.`);

    } catch (error) {
        console.error("[DEPLOY] An error occurred while deploying commands:", error);
    }
})();
