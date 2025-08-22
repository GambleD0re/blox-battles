// discord-bot/bot.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection } = require('discord.js');

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!DISCORD_BOT_TOKEN) {
    console.error("FATAL: DISCORD_BOT_TOKEN is not defined in the environment.");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
    ]
});

client.commands = new Collection();

// Recursive function to load commands from nested directories
const loadCommands = (dir) => {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            loadCommands(fullPath);
        } else if (file.name.endsWith('.js')) {
            const command = require(fullPath);
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                console.log(`[COMMANDS] Loaded /${command.data.name} from ${fullPath}`);
            } else {
                console.warn(`[WARNING] Command at ${fullPath} is missing "data" or "execute".`);
            }
        }
    }
};

// Recursive function to load events
const loadEvents = (dir) => {
    const files = fs.readdirSync(dir).filter(file => file.endsWith('.js'));
    for (const file of files) {
        const filePath = path.join(dir, file);
        const event = require(filePath);
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`[EVENTS] Loaded event: ${event.name}`);
    }
};

// Load core and game-specific commands
loadCommands(path.join(__dirname, 'core', 'commands'));
loadCommands(path.join(__dirname, 'games'));

// Load core events
loadEvents(path.join(__dirname, 'core', 'events'));

client.login(DISCORD_BOT_TOKEN);
