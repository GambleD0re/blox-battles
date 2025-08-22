// discord-bot/deploy-commands.js
require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const { DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;

if (!DISCORD_BOT_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
    console.error("FATAL: Missing required Discord environment variables for command deployment.");
    process.exit(1);
}

const commands = [
    {
        name: 'link',
        description: 'Link your Discord account to your Blox Battles account.',
    },
    {
        name: 'unlink',
        description: 'Unlink your Discord account from your Blox Battles account.',
    },
    {
        name: 'challenge',
        description: 'Challenge another player to a Rivals duel.',
        options: [
            {
                name: 'opponent',
                type: ApplicationCommandOptionType.User,
                description: 'The user you want to challenge',
                required: true,
            },
        ],
    },
    {
        name: 'ticket',
        description: 'Create a new support ticket or appeal.',
    },
];

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
