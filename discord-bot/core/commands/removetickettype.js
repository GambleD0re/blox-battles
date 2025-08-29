// discord-bot/core/commands/removetickettype.js
const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const { apiClient } = require('../utils/apiClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('removetickettype')
        .setDescription('Removes a ticket type and its associated category.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The ticket type to remove.')
                .setRequired(true)
                .setAutocomplete(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .setDMPermission(false),
    async autocomplete(interaction) {
        try {
            const { data: ticketTypes } = await apiClient.get('/ticket-types?deletable=true');
            const focusedValue = interaction.options.getFocused();
            const choices = ticketTypes
                .filter(type => type.name.toLowerCase().startsWith(focusedValue.toLowerCase()))
                .map(type => ({ name: type.name, value: type.name }));
            
            await interaction.respond(choices.slice(0, 25));
        } catch (error) {
            console.error('Autocomplete for removetickettype failed:', error);
            await interaction.respond([]);
        }
    },
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const typeName = interaction.options.getString('name');

        try {
            const { data: ticketTypes } = await apiClient.get('/ticket-types');
            const typeToDelete = ticketTypes.find(t => t.name === typeName);

            if (!typeToDelete) {
                return interaction.editReply({ content: `❌ **Error:** Ticket type "${typeName}" not found.` });
            }

            await apiClient.delete(`/ticket-types/${typeName}`);
            
            const category = await interaction.guild.channels.fetch(typeToDelete.categoryId).catch(() => null);
            if (category) {
                await category.delete(`Ticket type removed by ${interaction.user.tag}`);
            }

            await interaction.editReply({ content: `✅ Successfully removed the "${typeName}" ticket type and its category.` });

        } catch (error) {
            const errorMessage = error.response?.data?.message || 'An unexpected error occurred.';
            await interaction.editReply({ content: `❌ **Error:** ${errorMessage}` });
        }
    },
};
