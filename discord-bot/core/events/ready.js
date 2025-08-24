// discord-bot/core/events/ready.js
const { Events, ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { apiClient } = require('../utils/apiClient');
const { cacheGameData, cacheActiveGamesList, getGameChoices } = require('../utils/gameData');
const { startTaskProcessor } = require('../tasks/taskProcessor');
const { startStatusUpdaters } = require('../utils/statusUpdater');
const { cacheStatuses, isCommandEnabled, getEnabledTicketTypes } = require('../utils/statusCache');

const { SUPPORT_STAFF_ROLE_ID, SUPPORT_TICKETS_CATEGORY_ID } = process.env;

async function createInitializationTicket(client, startupStatus) {
    if (!SUPPORT_STAFF_ROLE_ID || !SUPPORT_TICKETS_CATEGORY_ID) {
        console.warn('[INIT TICKET] Missing environment variables for initialization ticket. Skipping.');
        return;
    }

    try {
        const guild = client.guilds.cache.first();
        if (!guild) return;

        const channelName = 'bot-initialization-log';
        let channel = guild.channels.cache.find(c => c.name === channelName && c.parentId === SUPPORT_TICKETS_CATEGORY_ID);

        if (channel) {
            try { await channel.delete('Clearing old initialization log.'); await asyncio.sleep(1); } catch (e) { console.warn("Could not clear old init channel."); }
        }

        const permissionOverwrites = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: SUPPORT_STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        ];

        channel = await guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,
            parent: SUPPORT_TICKETS_CATEGORY_ID,
            topic: `Bot status and initialization logs. Do not delete.`,
            permissionOverwrites,
        });

        const embed = new EmbedBuilder()
            .setColor(startupStatus.success ? 0x3fb950 : 0xf85149)
            .setTitle(startupStatus.success ? '✅ Bot Initialized Successfully' : '⚠️ Bot Initialized with Errors')
            .setDescription('This is a summary of the bot\'s startup sequence.')
            .addFields(
                { name: 'Games Cached', value: startupStatus.gamesCached, inline: true },
                { name: 'Commands Enabled', value: startupStatus.commandsCached, inline: true },
                { name: 'Ticket Types Enabled', value: startupStatus.ticketTypesCached, inline: true },
                { name: 'Services Status', value: startupStatus.services.join('\n'), inline: false },
            )
            .setTimestamp()
            .setFooter({ text: 'Blox Battles Bot' });

        if (startupStatus.errors.length > 0) {
            embed.addFields({ name: 'Errors Encountered', value: `\`\`\`${startupStatus.errors.join('\n')}\`\`\`` });
        }

        const row = new ActionRowBuilder()
            .addComponents(new ButtonBuilder().setCustomId('ticket_close_init').setLabel('Archive Log Channel').setStyle(ButtonStyle.Secondary));

        await channel.send({ content: `<@&${SUPPORT_STAFF_ROLE_ID}>`, embeds: [embed], components: [row] });
    } catch (error) {
        console.error('[INIT TICKET] Failed to create or post in initialization ticket:', error);
    }
}

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Bot logged in as ${client.user.tag}!`);

        const startupStatus = {
            success: true,
            gamesCached: '0',
            commandsCached: '0',
            ticketTypesCached: '0',
            services: [],
            errors: []
        };

        try {
            await cacheActiveGamesList();
            const gameChoices = getGameChoices();
            startupStatus.gamesCached = `${gameChoices.length} (${gameChoices.map(g => g.name).join(', ')})`;
            
            for (const game of gameChoices) {
                await cacheGameData(game.value);
            }
            
            await cacheStatuses();
            startupStatus.commandsCached = `${Array.from(isCommandEnabled(c => c)).length}`;
            startupStatus.ticketTypesCached = `${getEnabledTicketTypes().length}`;

            startTaskProcessor(client);
            startupStatus.services.push('✅ Task Processor Started');
            
            startStatusUpdaters(client);
            startupStatus.services.push('✅ Status Updaters Started');

        } catch (error) {
            startupStatus.success = false;
            startupStatus.errors.push(error.message);
            console.error("A critical error occurred during bot initialization:", error);
        }
        
        await createInitializationTicket(client, startupStatus);
        
        console.log("Bot initialization complete. Systems are running.");
    },
};
