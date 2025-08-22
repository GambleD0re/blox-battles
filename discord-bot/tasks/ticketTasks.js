// discord-bot/tasks/ticketTasks.js
const { ChannelType, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { apiClient } = require('../utils/apiClient');

const { SUPPORT_STAFF_ROLE_ID, SUPPORT_TICKETS_CATEGORY_ID } = process.env;

async function handleCreateTicketChannel(client, task) {
    const { ticket_id, user_discord_id, ticket_type, subject, description } = task.payload;

    const guild = client.guilds.cache.first();
    if (!guild) throw new Error("Bot is not in any guild.");

    const user = await guild.members.fetch(user_discord_id).catch(() => null);
    if (!user) throw new Error(`User with Discord ID ${user_discord_id} not found.`);

    const categoryChannel = guild.channels.cache.get(SUPPORT_TICKETS_CATEGORY_ID);
    if (!categoryChannel) throw new Error(`Support category with ID ${SUPPORT_TICKETS_CATEGORY_ID} not found.`);

    const channelName = `ticket-${user.user.username}-${ticket_id.substring(0, 4)}`;
    const permissionOverwrites = [
        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels] },
    ];
    if (SUPPORT_STAFF_ROLE_ID) {
        permissionOverwrites.push({ id: SUPPORT_STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] });
    }

    const channel = await guild.channels.create({
        name: channelName, type: ChannelType.GuildText, parent: categoryChannel,
        topic: `Ticket ID: ${ticket_id} | User ID: ${user_discord_id}`,
        permissionOverwrites,
    });

    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle(`Ticket: ${subject}`)
        .setDescription(`Welcome, ${user}! A staff member will be with you shortly.\n\n**Initial Message:**\n>>> ${description}`)
        .setTimestamp()
        .setFooter({ text: `Ticket ID: ${ticket_id}` });

    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger));
    
    await channel.send({ content: `<@${user.id}> ${SUPPORT_STAFF_ROLE_ID ? `<@&${SUPPORT_STAFF_ROLE_ID}>` : ''}`, embeds: [embed], components: [row] });
    await apiClient.post(`/tickets/${ticket_id}/channel`, { channelId: channel.id });

    console.log(`[TICKETS] Created channel ${channel.id} for ticket ${ticket_id}.`);
}

module.exports = { handleCreateTicketChannel };
