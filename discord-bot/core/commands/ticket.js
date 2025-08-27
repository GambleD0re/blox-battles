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
            
            // Use the valid user-profile endpoint to get user status
            const { data } = await apiClient.get(`/discord/user-profile/${interaction.user.id}`);
            const user = data.user;

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
            // This catch block will now correctly handle users who haven't linked their account (API returns 404)
            const errorMessage = error.response?.status === 404 
                ? 'You must link your Blox Battles account before creating a ticket. Please use the `/link` command first.'
                : error.response?.data?.message || 'An error occurred during the ticket process.';
            await interaction.editReply({ content: `❌ **Error:** ${errorMessage}`, components: [] });
        }
    },
};
