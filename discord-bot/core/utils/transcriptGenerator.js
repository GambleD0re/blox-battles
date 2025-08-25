// discord-bot/core/utils/transcriptGenerator.js
const { Collection } = require('discord.js');

async function generateTranscript(channel) {
    let content = `Transcript for ticket channel #${channel.name}\nGenerated on: ${new Date().toUTCString()}\n\n`;
    let lastMessageId;
    const messages = new Collection();

    while (true) {
        const fetchedMessages = await channel.messages.fetch({
            limit: 100,
            before: lastMessageId,
        });

        if (fetchedMessages.size === 0) break;

        fetchedMessages.forEach(msg => messages.set(msg.id, msg));
        lastMessageId = fetchedMessages.lastKey();
    }

    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const msg of sortedMessages) {
        const timestamp = new Date(msg.createdTimestamp).toLocaleString('en-US', { timeZone: 'UTC' });
        let messageContent = msg.content;
        
        messageContent = messageContent.replace(/<@!?(\d+)>/g, (match, userId) => `@${msg.client.users.cache.get(userId)?.username || 'unknown-user'}`);
        messageContent = messageContent.replace(/<@&(\d+)>/g, (match, roleId) => `@${msg.guild.roles.cache.get(roleId)?.name || 'unknown-role'}`);
        
        content += `[${timestamp}] ${msg.author.tag}: ${messageContent}\n`;

        if (msg.attachments.size > 0) {
            msg.attachments.forEach(att => {
                content += `[Attachment: ${att.name}](${att.url})\n`;
            });
        }
    }

    return content;
}

module.exports = { generateTranscript };
