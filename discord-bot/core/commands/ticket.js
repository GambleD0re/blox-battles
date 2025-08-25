// discord-bot/core/commands/ticket.js
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { apiClient } = require('../utils/apiClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a new support ticket or appeal.'),
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            const { data } = await apiClient.post('/discord/check-user', { discordId: interaction.user.id });
            const user = data.user;

            if (!user) {
                return interaction.editReply({ content: 'You must link your Blox Battles account before creating a ticket. Please use the `/link` command first.' });
            }

            if (user.open_tickets && user.open_tickets.length > 0) {
                 return interaction.editReply({ content: `You already have an open ticket. Please wait for it to be resolved before creating a new one.` });
            }

            const isBanned = user.status === 'banned';
            const selectMenuOptions = [
                new StringSelectMenuOptionBuilder().setLabel('Support Request').setValue('support').setDescription('For billing, technical issues, or other questions.')
            ];
            if (isBanned) {
                selectMenuOptions.unshift(new StringSelectMenuOptionBuilder().setLabel('Ban Appeal').setValue('ban_appeal').setDescription('Appeal a temporary or permanent ban.'));
            }

            const ticketTypeSelect = new StringSelectMenuBuilder().setCustomId('ticket_type_select').setPlaceholder('Select the reason for your ticket').addOptions(selectMenuOptions);
            const row = new ActionRowBuilder().addComponents(ticketTypeSelect);

            await interaction.editReply({ content: 'Please select the type of ticket you wish to create.', components: [row] });
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'An error occurred during the ticket process.';
            await interaction.editReply({ content: `❌ **Error:** ${errorMessage}`, components: [] });
        }
    },
};
