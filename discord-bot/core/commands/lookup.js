// discord-bot/core/commands/lookup.js
const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { apiClient } = require('../utils/apiClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lookup')
        .setDescription('Looks up a user\'s full platform profile. (Staff Only)')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The Discord user to look up.')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ModerateMembers)
        .setDMPermission(false),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const targetUser = interaction.options.getUser('user');

        try {
            const { data } = await apiClient.get(`/admin/user-lookup/${targetUser.id}`);
            const { user, gameProfiles, transactions, tickets } = data;

            const embed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setTitle(`🔍 User Lookup: ${user.username}`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: 'Core Info', value: `**Email:** ${user.email}\n**Gems:** ${user.gems}\n**Status:** ${user.status}` },
                );
            
            if (user.status === 'banned') {
                embed.addFields({ name: 'Ban Info', value: `**Reason:** ${user.ban_reason}\n**Expires:** ${user.ban_expires_at ? new Date(user.ban_expires_at).toLocaleString() : 'Permanent'}` });
            }

            if (gameProfiles && gameProfiles.length > 0) {
                const profileStrings = gameProfiles.map(p => `**${p.game_name}**: \`${p.linked_game_username}\` (W/L: ${p.wins}/${p.losses})`);
                embed.addFields({ name: 'Game Profiles', value: profileStrings.join('\n') });
            }

            if (transactions && transactions.length > 0) {
                const transactionStrings = transactions.map(t => `\`${new Date(t.created_at).toLocaleDateString()}\` - ${t.type}: **${t.amount_gems}** Gems`);
                embed.addFields({ name: 'Recent Transactions', value: transactionStrings.join('\n') });
            }

             if (tickets && tickets.length > 0) {
                const ticketStrings = tickets.map(t => `\`${t.id.substring(0,8)}\` - ${t.subject} (**${t.status}**)`);
                embed.addFields({ name: 'Recent Tickets', value: ticketStrings.join('\n') });
            }
            
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            const errorMessage = error.response?.data?.message || 'An unexpected error occurred.';
            await interaction.editReply({ content: `❌ **Error:** ${errorMessage}` });
        }
    },
};
