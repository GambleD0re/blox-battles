// discord-bot/deploy-commands.js
require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
    console.error("FATAL: Missing required Discord environment variables for command deployment.");
    process.exit(1);
}

const commands = [];

const findCommandFiles = (dir) => {
    // Check if the directory exists before trying to read it.
    if (!fs.existsSync(dir)) {
        console.log(`[DEPLOY] Skipping non-existent directory: ${dir}`);
        return;
    }

    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            findCommandFiles(fullPath);
        } else if (file.name.endsWith('.js')) {
            const command = require(fullPath);
            if ('data' in command && 'execute' in command) {
                commands.push(command.data.toJSON());
            } else {
                console.warn(`[DEPLOY] Command at ${fullPath} is invalid.`);
            }
        }
    }
};

// Find all commands in core and games directories
findCommandFiles(path.join(__dirname, 'core', 'commands'));
findCommandFiles(path.join(__dirname, 'games'));

const rest = new REST({ version: '10' }).setToken(DISCORD_BOT_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands for guild ${DISCORD_GUILD_ID}.`);
        const data = await rest.put(
            Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID),
            { body: commands },
        );
        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error("An error occurred while deploying commands:", error);
    }
})();
