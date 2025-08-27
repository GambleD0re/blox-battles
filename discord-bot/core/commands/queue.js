// discord-bot/core/commands/queue.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { apiClient } = require('../utils/apiClient');
const { getGameData, getGameChoices } = require('../utils/gameData');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Join the matchmaking queue for a specific game.')
        .addStringOption(option =>
            option.setName('game')
                .setDescription('The game you want to queue for.')
                .setRequired(true)
                .addChoices(...getGameChoices())),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const gameId = interaction.options.getString('game');
        const gameName = getGameChoices().find(g => g.value === gameId)?.name || 'the game';

        try {
            const gameData = getGameData(gameId);
            if (!gameData || !gameData.maps) {
                return interaction.editReply(`Game data for ${gameName} is not available.`);
            }

            const mapOptions = gameData.maps.map(map => ({ label: map.name, value: map.id }));

            const wagerButtons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder().setCustomId(`q_wager_50_${gameId}`).setLabel('50').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`q_wager_100_${gameId}`).setLabel('100').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`q_wager_250_${gameId}`).setLabel('250').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`q_wager_500_${gameId}`).setLabel('500').setStyle(ButtonStyle.Primary)
                );
            
            const mapSelect = new ActionRowBuilder()
                .addComponents(new StringSelectMenuBuilder().setCustomId(`q_mapban_${gameId}`).setPlaceholder('Select a map to ban').addOptions(mapOptions.slice(0, 25)));

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`⚔️ Joining ${gameName} Quick Match`)
                .setDescription('Please select your wager and a map to ban.');

            const message = await interaction.editReply({ embeds: [embed], components: [wagerButtons, mapSelect] });
            const collector = message.createMessageComponentCollector({ time: 60000 });

            let selectedWager = null, bannedMap = null;

            collector.on('collect', async i => {
                const [type, value] = i.customId.split('_').slice(1);
                
                if (type === 'wager') selectedWager = parseInt(value, 10);
                if (type === 'mapban') bannedMap = i.values[0];

                if (selectedWager && bannedMap) {
                    await i.deferUpdate();
                    try {
                        // For Rivals, the only game currently, banned_weapons are required. We'll send an empty array for now.
                        // This can be expanded with a weapon selection modal in the future if needed.
                        const preferences = { region: 'NA-East', banned_map: bannedMap, banned_weapons: [] };
                        
                        await apiClient.post(`/games/${gameId}/queue/join`, { wager: selectedWager, preferences });
                        await interaction.editReply({ content: `✅ You have joined the ${gameName} queue!`, embeds: [], components: [] });
                        collector.stop();
                    } catch (err) {
                        await interaction.editReply({ content: `❌ Error: ${err.response?.data?.message || err.message}`, embeds: [], components: [] });
                        collector.stop();
                    }
                } else {
                    await i.deferUpdate();
                    embed.setDescription(`**Wager:** ${selectedWager || 'Not set'}\n**Banned Map:** ${bannedMap ? gameData.maps.find(m => m.id === bannedMap).name : 'Not set'}`);
                    await interaction.editReply({ embeds: [embed] });
                }
            });

            collector.on('end', collected => {
                if (collected.size === 0) interaction.editReply({ content: 'Queue join timed out.', embeds: [], components: [] });
            });

        } catch (error) {
            await interaction.editReply({ content: `❌ ${error.response?.data?.message || 'An error occurred.'}` });
        }
    }
};
