// discord-bot/core/utils/transcriptGenerator.js
const { Collection } = require('discord.js');

async function generateTranscript(channel) {
    let content = `Transcript for ticket channel #${channel.name}\nGenerated on: ${new Date().toUTCString()}\n\n---\n\n`;
    let lastMessageId;
    const messages = new Collection();

    while (true) {
        const fetchedMessages = await channel.messages.fetch({
            limit: 100,
            before: lastMessageId,
        });

        if (fetchedMessages.size === 0) {
            break;
        }

        fetchedMessages.forEach(msg => messages.set(msg.id, msg));
        lastMessageId = fetchedMessages.lastKey();
    }

    const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

    for (const msg of sortedMessages) {
        const timestamp = new Date(msg.createdTimestamp).toLocaleString('en-US', { timeZone: 'UTC' });
        let messageContent = msg.content;

        // Handle mentions correctly
        if (msg.mentions.users.size > 0) {
            msg.mentions.users.forEach(user => {
                messageContent = messageContent.replace(new RegExp(`<@!?${user.id}>`, 'g'), `@${user.username}`);
            });
        }
        if (msg.mentions.roles.size > 0) {
            msg.mentions.roles.forEach(role => {
                messageContent = messageContent.replace(new RegExp(`<@&${role.id}>`, 'g'), `@${role.name}`);
            });
        }
        
        content += `[${timestamp}] ${msg.author.tag}:\n`;
        if (messageContent) {
            content += `${messageContent}\n`;
        }

        // [FIXED] Handle and format embed content
        if (msg.embeds.length > 0) {
            for (const embed of msg.embeds) {
                content += `[EMBED]\n`;
                if (embed.title) content += `  Title: ${embed.title}\n`;
                if (embed.description) content += `  Description: ${embed.description}\n`;
                if (embed.fields.length > 0) {
                    embed.fields.forEach(field => {
                        content += `  Field: "${field.name}" - "${field.value}"\n`;
                    });
                }
            }
        }

        if (msg.attachments.size > 0) {
            msg.attachments.forEach(att => {
                content += `[Attachment: ${att.name}](${att.url})\n`;
            });
        }
        content += `\n---\n\n`;
    }

    return content;
}

module.exports = { generateTranscript };
