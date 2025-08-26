// discord-bot/core/events/interactionCreate.js
const { Events, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } = require('discord.js');
const { apiClient } = require('../utils/apiClient');

const { SUPPORT_STAFF_ROLE_ID } = process.env;

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            if (!command) return;
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
                    const response = await apiClient.post('/discord/tickets', { 
                        type: ticketType, 
                        subject, 
                        message: description, 
                        discordId: interaction.user.id 
                    });
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
                        discordUsername: interaction.user.globalName || interaction.user.username,
                    });
                    await interaction.editReply({ content: `✅ ${response.data.message} Please check your inbox on the website to confirm.` });
                } catch (error) {
                    await interaction.editReply({ content: `❌ ${error.response?.data?.message || 'An error occurred.'}` });
                }
            } else if (interaction.customId.startsWith('ticket_close_modal_')) {
                await interaction.deferReply({ content: 'Closing and archiving ticket...', ephemeral: true });
                const ticketId = interaction.customId.split('_')[3];
                const reason = interaction.fields.getTextInputValue('ticket_close_reason');
                
                try {
                    const payload = { 
                        ticketId, 
                        channelId: interaction.channel.id, 
                        closedBy: interaction.user.tag,
                        reason: reason || 'No reason provided.'
                    };
                    await apiClient.post('/discord/tasks', { task_type: 'CLOSE_TICKET', payload });
                    await interaction.editReply({ content: 'Ticket has been queued for archival.' });
                } catch (error) {
                    await interaction.editReply({ content: `❌ **Error:** ${error.response?.data?.message || 'Failed to queue ticket for closure.'}` });
                }
            }
        } else if (interaction.isButton()) {
            const [action, subAction, ...rest] = interaction.customId.split('_');

            if (action === 'ticket') {
                const ticketId = rest.join('_');

                if (!interaction.member.roles.cache.has(SUPPORT_STAFF_ROLE_ID)) {
                    return interaction.reply({ content: 'You do not have permission to perform this action.', ephemeral: true });
                }

                if (subAction === 'claim') {
                    await interaction.deferUpdate();
                    
                    // [NEW] Rename channel and re-sort category
                    const channel = interaction.channel;
                    if (channel.name.startsWith('U-')) {
                        const newName = channel.name.replace(/^U-/, 'C-');
                        await channel.setName(newName, 'Ticket Claimed');

                        const category = channel.parent;
                        if (category) {
                            try {
                                const channelsInCategory = Array.from(category.children.cache.values());
                                const sortedChannels = channelsInCategory.sort((a, b) => a.name.localeCompare(b.name));
                                
                                const positionUpdates = sortedChannels.map((ch, index) => ({
                                    channel: ch.id,
                                    position: index,
                                }));

                                await interaction.guild.channels.setPositions(positionUpdates);
                            } catch (sortError) {
                                console.error("Could not re-sort ticket channels:", sortError);
                                // Don't block the rest of the flow if sorting fails
                            }
                        }
                    }

                    await interaction.channel.send(`> 🔔 Ticket claimed by ${interaction.user}. They will be with you shortly.`);
                    
                    const originalMessage = interaction.message;
                    const updatedButtons = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('ticket_claimed').setLabel('Claimed').setStyle(ButtonStyle.Success).setDisabled(true),
                        new ButtonBuilder().setCustomId(interaction.customId.replace('claim', 'close')).setLabel('Close Ticket').setStyle(ButtonStyle.Danger)
                    );
                    await originalMessage.edit({ components: [updatedButtons] });

                } else if (subAction === 'close') {
                    const modal = new ModalBuilder()
                        .setCustomId(`ticket_close_modal_${ticketId}`)
                        .setTitle('Close Support Ticket');
                    
                    const reasonInput = new TextInputBuilder()
                        .setCustomId('ticket_close_reason')
                        .setLabel("Reason for Closing (Optional)")
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('e.g., Issue resolved.')
                        .setRequired(false);

                    const actionRow = new ActionRowBuilder().addComponents(reasonInput);
                    modal.addComponents(actionRow);

                    await interaction.showModal(modal);
                }
            }
        }
    },
};
