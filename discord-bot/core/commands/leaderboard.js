// discord-bot/core/commands/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { apiClient } = require('../utils/apiClient');
const { getGameChoices } = require('../utils/gameData');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the top 10 players for a specific game.')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game to show the leaderboard for.')
                .setRequired(true)
                .addChoices(...getGameChoices())),
    async execute(interaction) {
        await interaction.deferReply();
        const gameId = interaction.options.getString('game');
        const gameName = getGameChoices().find(g => g.value === gameId)?.name || 'the Game';
        
        try {
            const { data: leaderboard } = await apiClient.get(`/games/${gameId}/leaderboard`);

            if (!leaderboard || leaderboard.length === 0) {
                return interaction.editReply({ content: `There are no ranked players for ${gameName} yet.` });
            }
            
            const medalEmojis = ['🥇', '🥈', '🥉'];
            const leaderboardString = leaderboard
                .map((player, index) => {
                    const rank = medalEmojis[index] || `**${index + 1}.**`;
                    return `${rank} \`${player.username}\` - ${player.wins} Wins / ${player.losses} Losses`;
                })
                .join('\n');

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F)
                .setTitle(`🏆 Top 10 ${gameName} Duelers`)
                .setDescription(leaderboardString)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Could not fetch the leaderboard at this time.';
            await interaction.editReply({ content: `❌ **Error:** ${errorMessage}`, ephemeral: true });
        }
    },
};
