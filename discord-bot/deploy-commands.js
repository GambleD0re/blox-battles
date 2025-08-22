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
    {
        name: 'reactionrole',
        description: 'Manage reaction roles for the server.',
        default_member_permissions: String(1 << 5), // Manage Roles permission
        dm_permission: false,
        options: [
            {
                name: 'setup',
                description: 'Creates a new message/embed for reaction roles.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'channel', description: 'The channel for the message.', type: ApplicationCommandOptionType.Channel, required: true },
                    { name: 'title', description: 'The title of the embed message.', type: ApplicationCommandOptionType.String, required: true },
                    { name: 'description', description: 'The main text of the embed. Use "\\n" for new lines.', type: ApplicationCommandOptionType.String, required: true },
                    { name: 'color', description: 'A hex color code for the embed (e.g., #58a6ff).', type: ApplicationCommandOptionType.String, required: false },
                ]
            },
            {
                name: 'add',
                description: 'Adds a role-to-emoji mapping to a message.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'message_id', description: 'The message ID of the reaction role embed.', type: ApplicationCommandOptionType.String, required: true },
                    { name: 'emoji', description: 'The emoji to react with.', type: ApplicationCommandOptionType.String, required: true },
                    { name: 'role', description: 'The role to assign.', type: ApplicationCommandOptionType.Role, required: true },
                ]
            },
            {
                name: 'remove',
                description: 'Removes a role-to-emoji mapping from a message.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'message_id', description: 'The message ID of the reaction role embed.', type: ApplicationCommandOptionType.String, required: true },
                    { name: 'emoji', description: 'The emoji of the rule to remove.', type: ApplicationCommandOptionType.String, required: true },
                ]
            },
            {
                name: 'list',
                description: 'Lists all configured reaction roles for a specific message.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    { name: 'message_id', description: 'The message ID of the reaction role embed.', type: ApplicationCommandOptionType.String, required: true },
                ]
            }
        ]
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
