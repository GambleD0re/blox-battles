// discord-bot/games/rivals/commands/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { apiClient } = require('../../../core/utils/apiClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the top 10 players for a specific game.')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game to show the leaderboard for.')
                .setRequired(true)
                .addChoices(
                    { name: 'Rivals', value: 'rivals' }
                )),
    async execute(interaction) {
        await interaction.deferReply();
        const gameId = interaction.options.getString('game');
        
        try {
            const { data: leaderboard } = await apiClient.get(`/games/${gameId}/leaderboard`);

            if (!leaderboard || leaderboard.length === 0) {
                return interaction.editReply({ content: `There are no ranked players for ${gameId} yet.` });
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
                .setTitle(`🏆 Top 10 ${gameId.charAt(0).toUpperCase() + gameId.slice(1)} Duelers`)
                .setDescription(leaderboardString)
                .setTimestamp();
            
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Could not fetch the leaderboard at this time.';
            await interaction.editReply({ content: `❌ **Error:** ${errorMessage}`, ephemeral: true });
        }
    },
};
