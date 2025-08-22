// discord-bot/commands/link.js
const { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Discord account to your Blox Battles account.'),
    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('link_account_modal')
            .setTitle('Link Blox Battles Account');

        const usernameInput = new TextInputBuilder()
            .setCustomId('bb_username_input')
            .setLabel("What is your Blox Battles username?")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter your exact Blox Battles username')
            .setRequired(true);

        const actionRow = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(actionRow);

        await interaction.showModal(modal);
    },
};
