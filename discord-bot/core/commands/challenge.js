// discord-bot/core/commands/challenge.js
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, EmbedBuilder } = require('discord.js');
const { apiClient } = require('../utils/apiClient');
const { getGameData, getGameChoices } = require('../utils/gameData');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('challenge')
        .setDescription('Challenge another player to a duel in a specific game.')
        .addUserOption(option =>
            option.setName('opponent')
                .setDescription('The user you want to challenge.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game you want to play.')
                .setRequired(true)
                .addChoices(...getGameChoices())), // Dynamically adds game choices
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const opponent = interaction.options.getUser('opponent');
        const challenger = interaction.user;
        const gameId = interaction.options.getString('game');
        const gameName = getGameChoices().find(g => g.value === gameId)?.name || 'the game';

        if (opponent.bot || opponent.id === challenger.id) {
            return interaction.editReply({ content: 'You cannot challenge yourself or a bot.' });
        }

        try {
            // [MODIFIED] Use dynamic API endpoint for pre-check
            const { data } = await apiClient.post(`/games/${gameId}/duels/pre-check`, {
                challengerDiscordId: challenger.id,
                opponentDiscordId: opponent.id,
            });

            const gameData = getGameData(gameId);
            if (!gameData || !gameData.maps) {
                return interaction.editReply({ content: `Could not retrieve game data for ${gameName}. Please try again later.` });
            }
            const mapOptions = gameData.maps.map(map => ({ label: map.name, value: map.id }));

            const wagerButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`wager_100_${gameId}`).setLabel('100').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`wager_250_${gameId}`).setLabel('250').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`wager_500_${gameId}`).setLabel('500').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`wager_1000_${gameId}`).setLabel('1,000').setStyle(ButtonStyle.Primary)
                );
            
            const mapSelect = new ActionRowBuilder()
                .addComponents(new StringSelectMenuBuilder().setCustomId(`map_select_${gameId}`).setPlaceholder('Select a map').addOptions(mapOptions.slice(0, 25)));

            const embed = new EmbedBuilder()
                .setColor(0x58a6ff)
                .setTitle(`⚔️ Creating ${gameName} Duel vs ${opponent.username}`)
                .setDescription('Select a wager and a map.')
                .addFields({ name: 'Your Gems', value: data.challenger.gems.toLocaleString(), inline: true });

            const message = await interaction.editReply({ embeds: [embed], components: [wagerButtons, mapSelect] });
            const collector = message.createMessageComponentCollector({ time: 60000 });
            let selectedWager = null, selectedMap = null;

            collector.on('collect', async i => {
                if (i.customId.startsWith('wager_')) selectedWager = parseInt(i.customId.split('_')[1], 10);
                if (i.customId.startsWith('map_select_')) selectedMap = i.values[0];

                if (selectedWager && selectedMap) {
                    await i.deferUpdate();
                    try {
                        // [MODIFIED] Use dynamic API endpoint for creation
                        await apiClient.post(`/games/${gameId}/duels/create`, {
                            challengerDiscordId: challenger.id, opponentDiscordId: opponent.id, wager: selectedWager,
                            rules: { map: selectedMap, region: 'NA-East', banned_weapons: [] }
                        });
                        await interaction.editReply({ content: `✅ Challenge for ${gameName} sent to ${opponent.username}!`, embeds: [], components: [] });
                        collector.stop();
                    } catch (err) {
                        await interaction.editReply({ content: `❌ Error: ${err.response?.data?.message || err.message}`, embeds: [], components: [] });
                        collector.stop();
                    }
                } else {
                    await i.deferUpdate();
                    embed.setDescription(`**Wager:** ${selectedWager || 'Not set'} | **Map:** ${selectedMap ? gameData.maps.find(m=>m.id === selectedMap).name : 'Not set'}`);
                    await interaction.editReply({ embeds: [embed] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) interaction.editReply({ content: 'Challenge creation timed out.', embeds: [], components: [] });
            });
        } catch (error) {
            await interaction.editReply({ content: `❌ ${error.response?.data?.message || 'An error occurred.'}`, embeds: [], components: [] });
        }
    },
};
