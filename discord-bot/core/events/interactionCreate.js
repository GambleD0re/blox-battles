// discord-bot/core/events/interactionCreate.js
const { Events, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { apiClient } = require('../utils/apiClient');
const { isCommandEnabled } = require('../utils/statusCache'); // [ADDED]

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;

            // [ADDED] Centralized check for command status
            if (!isCommandEnabled(interaction.commandName)) {
                return interaction.reply({ content: 'This command is temporarily disabled by an administrator.', ephemeral: true });
            }

            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing ${interaction.commandName}`, error);
                const errorMessage = 'There was an error while executing this command!';
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        } else if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'ticket_type_select') {
                const ticketType = interaction.values[0];
                const modal = new ModalBuilder()
                    .setCustomId(`ticket_creation_modal_${ticketType}`)
                    .setTitle(`Create a ${ticketType === 'support' ? 'Support' : 'Ban Appeal'} Ticket`);
                
                const subjectInput = new TextInputBuilder().setCustomId('ticket_subject_input').setLabel("Subject").setStyle(TextInputStyle.Short).setRequired(true);
                const descriptionInput = new TextInputBuilder().setCustomId('ticket_description_input').setLabel("Please describe your issue in detail").setStyle(TextInputStyle.Paragraph).setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(subjectInput), new ActionRowBuilder().addComponents(descriptionInput));
                await interaction.showModal(modal);
            }
        } else if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('ticket_creation_modal_')) {
                await interaction.deferReply({ ephemeral: true });
                const ticketType = interaction.customId.split('_')[3];
                const subject = interaction.fields.getTextInputValue('ticket_subject_input');
                const description = interaction.fields.getTextInputValue('ticket_description_input');
                try {
                    const response = await apiClient.post('/tickets', { type: ticketType, subject, message: description, discordId: interaction.user.id });
                    await interaction.editReply({ content: response.data.message });
                } catch (error) {
                    await interaction.editReply({ content: `❌ **Error:** ${error.response?.data?.message || 'Failed to create ticket.'}` });
                }
            } else if (interaction.customId === 'link_account_modal') {
                await interaction.deferReply({ ephemeral: true });
                const username = interaction.fields.getTextInputValue('bb_username_input');
                try {
                    const response = await apiClient.post('/discord/initiate-link', {
                        username,
                        discordId: interaction.user.id,
                        discordUsername: interaction.user.username,
                    });
                    await interaction.editReply({ content: `✅ ${response.data.message} Please check your inbox on the website to confirm.` });
                } catch (error) {
                    await interaction.editReply({ content: `❌ ${error.response?.data?.message || 'An error occurred.'}` });
                }
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('ticket_close_')) {
                const ticketId = interaction.customId.split('_')[2];
                try {
                    await interaction.deferReply({ content: 'Closing ticket...', ephemeral: true });
                    const payload = { ticketId, channelId: interaction.channel.id, closedBy: interaction.user.tag };
                    await apiClient.post('/tasks', { task_type: 'CLOSE_TICKET', payload });
                    await interaction.editReply({ content: 'Ticket has been queued for archival.' });
                } catch (error) {
                    await interaction.editReply({ content: `❌ **Error:** ${error.response?.data?.message || 'Failed to close ticket.'}` });
                }
            }
        }
    },
};
