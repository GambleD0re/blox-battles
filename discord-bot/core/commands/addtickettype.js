// discord-bot/core/commands/addtickettype.js
const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const { apiClient } = require('../utils/apiClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('addtickettype')
        .setDescription('Adds a new ticket type and creates a corresponding category.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the new ticket type (e.g., "Partnership Inquiry").')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const typeName = interaction.options.getString('name');
        const supportStaffRole = process.env.SUPPORT_STAFF_ROLE_ID;

        if (!supportStaffRole) {
            return interaction.editReply({ content: '❌ **Error:** `SUPPORT_STAFF_ROLE_ID` is not configured in the bot environment.' });
        }

        try {
            const category = await interaction.guild.channels.create({
                name: `SUPPORT - ${typeName}`,
                type: ChannelType.GuildCategory,
                permissionOverwrites: [
                    {
                        id: interaction.guild.id,
                        deny: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: supportStaffRole,
                        allow: [PermissionsBitField.Flags.ViewChannel],
                    },
                    {
                        id: interaction.client.user.id,
                        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels],
                    }
                ],
                reason: `New ticket type created by ${interaction.user.tag}`,
            });

            await apiClient.post('/ticket-types', {
                name: typeName,
                categoryId: category.id,
            });

            await interaction.editReply({ content: `✅ Successfully created the "${typeName}" ticket type and its category.` });

        } catch (error) {
            const errorMessage = error.response?.data?.message || 'An unexpected error occurred while creating the ticket type.';
            await interaction.editReply({ content: `❌ **Error:** ${errorMessage}` });
        }
    },
};
