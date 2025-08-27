// discord-bot/core/commands/profile.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { apiClient } = require('../utils/apiClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your or another user\'s Blox Battles profile.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose profile you want to view.')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply();
        
        const targetUser = interaction.options.getUser('user') || interaction.user;

        if (targetUser.bot) {
            return interaction.editReply({ content: 'You cannot look up a profile for a bot.', ephemeral: true });
        }

        try {
            const { data } = await apiClient.get(`/discord/user-profile/${targetUser.id}`);
            const { user, gameProfiles } = data;

            const embed = new EmbedBuilder()
                .setColor(0x58a6ff)
                .setTitle(`${user.username}'s Blox Battles Profile`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields({ name: '💎 Gems', value: user.gems.toLocaleString(), inline: true })
                .setFooter({ text: `Member Since: ${new Date(user.created_at).toLocaleDateString()}` });

            if (gameProfiles && gameProfiles.length > 0) {
                for (const profile of gameProfiles) {
                    embed.addFields({
                        name: `--- ${profile.game_name} Stats ---`,
                        value: `**Username:** \`${profile.linked_game_username}\`\n**Wins:** ${profile.wins}\n**Losses:** ${profile.losses}`
                    });
                }
            } else {
                 embed.addFields({ name: 'Game Profiles', value: 'No game accounts have been linked yet.' });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const errorMessage = error.response?.data?.message || 'An unexpected error occurred.';
            await interaction.editReply({ content: `❌ **Error:** ${errorMessage}`, ephemeral: true });
        }
    },
};
