// discord-bot/core/commands/ticket.js
const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { apiClient } = require('../utils/apiClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Create a new support ticket or appeal.'),
    async execute(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const { data: ticketTypes } = await apiClient.get('/ticket-types');
            
            if (!ticketTypes || ticketTypes.length === 0) {
                return interaction.editReply({ content: 'The ticket system is currently unavailable. Please try again later.' });
            }

            const selectMenuOptions = ticketTypes.map(type => ({
                label: type.name,
                value: type.name,
                description: `For issues related to ${type.name.toLowerCase()}.`
            }));

            const ticketTypeSelect = new StringSelectMenuBuilder()
                .setCustomId('ticket_type_select')
                .setPlaceholder('Select the reason for your ticket')
                .addOptions(selectMenuOptions);
            
            const row = new ActionRowBuilder().addComponents(ticketTypeSelect);

            await interaction.editReply({ content: 'Please select the type of ticket you wish to create.', components: [row] });

        } catch (error) {
            const errorMessage = error.response?.status === 404 
                ? 'You must link your Blox Battles account before creating a ticket. Please use the `/link` command first.'
                : error.response?.data?.message || 'An error occurred during the ticket process.';
            await interaction.editReply({ content: `❌ **Error:** ${errorMessage}`, components: [] });
        }
    },
};
