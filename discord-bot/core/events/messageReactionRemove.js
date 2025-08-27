// discord-bot/core/events/messageReactionRemove.js
const { Events } = require('discord.js');
const { apiClient } = require('../utils/apiClient');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        if (user.bot) return;
        if (reaction.partial) {
            try { await reaction.fetch(); }
            catch (error) { console.error('Failed to fetch partial reaction:', error); return; }
        }
        
        const emojiId = reaction.emoji.id || reaction.emoji.name;

        try {
            const response = await apiClient.get('/reaction-roles/lookup', {
                params: { messageId: reaction.message.id, emojiId: emojiId }
            });
            
            const { roleId } = response.data;
            if (!roleId) return;

            const member = await reaction.message.guild.members.fetch(user.id);
            const role = await reaction.message.guild.roles.fetch(roleId);

            if (!member || !role) return;
            if (role.position >= reaction.message.guild.members.me.roles.highest.position) {
                console.warn(`[ReactionRoles] Cannot remove role ${role.name} as it is higher than my own.`);
                return;
            }

            await member.roles.remove(role);
        } catch (error) {
            if (error.response && error.response.status === 404) return;
            console.error('Error in messageReactionRemove event:', error.response?.data?.message || error.message);
        }
    },
};
