// discord-bot/bot.js
require('dotenv').config();
const fs = require('fs');
const path = path('path');
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
const commandsPath = path.join(__dirname, 'core', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`[COMMANDS] Loaded /${command.data.name}`);
    } else {
        console.warn(`[WARNING] Command at ${filePath} is missing "data" or "execute".`);
    }
}

const eventsPath = path.join(__dirname, 'core', 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
    console.log(`[EVENTS] Loaded event: ${event.name}`);
}

client.login(DISCORD_BOT_TOKEN);
