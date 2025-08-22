// discord-bot/core/tasks/duelTasks.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const DUEL_RESULTS_CHANNEL_ID = process.env.DUEL_RESULTS_CHANNEL_ID;
const FRONTEND_URL = process.env.FRONTEND_URL;
const DUELER_ROLE_ID = process.env.DUELER_ROLE_ID;

async function handleDuelResult(client, task) {
    const { duelId, gameId, winner, loser, pot, finalScores } = task.payload;
    const isGhostDuel = duelId.toString().startsWith('ghost-');

    const embed = new EmbedBuilder()
        .setColor(0x3fb950)
        .setTitle(`⚔️ ${winner.username} vs. ${loser.username}`)
        .setThumbnail(winner.avatarUrl)
        .addFields(
            { name: '🏆 Winner', value: `**${winner.username}**`, inline: true },
            { name: '💰 Pot', value: `**${pot.toLocaleString()}** Gems`, inline: true },
            { name: '📊 Score', value: `\`${Object.values(finalScores).join(' - ')}\``, inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `${gameId.toUpperCase()} Duel ID: ${duelId}` });

    const components = [];
    if (!isGhostDuel) {
        const transcriptUrl = `${FRONTEND_URL}/transcripts/${duelId}`;
        embed.setURL(transcriptUrl);
        components.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View Full Transcript').setStyle(ButtonStyle.Link).setURL(transcriptUrl)));
    }
    
    const channel = await client.channels.fetch(DUEL_RESULTS_CHANNEL_ID);
    if (!channel) throw new Error(`Duel results channel with ID ${DUEL_RESULTS_CHANNEL_ID} not found.`);

    await channel.send({ embeds: [embed], components });
}

async function handleDmNotification(client, task, type) {
    const { payload } = task;
    let recipientId, embed, row;

    switch (type) {
        case 'link_success':
            recipientId = payload.discordId;
            embed = new EmbedBuilder().setColor(0x3fb950).setTitle('✅ Account Linked').setDescription('Your Blox Battles account is now linked to this Discord account!');
            if (DUELER_ROLE_ID) {
                try {
                    const guild = client.guilds.cache.first();
                    const member = await guild.members.fetch(recipientId);
                    if (member) await member.roles.add(DUELER_ROLE_ID);
                } catch (err) { console.error(`[ROLES] Failed to assign Dueler role to user ${recipientId}:`, err.message); }
            }
            break;
        case 'duel_challenge':
            recipientId = payload.recipientDiscordId;
            embed = new EmbedBuilder().setColor(0x58a6ff).setTitle('⚔️ You Have Been Challenged!').setDescription(`**${payload.challengerUsername}** challenged you to a Rivals duel.`).addFields({ name: 'Wager', value: `${payload.wager.toLocaleString()} Gems`, inline: true }, { name: 'Map', value: payload.mapName, inline: true });
            row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('View on Dashboard').setStyle(ButtonStyle.Link).setURL(`${FRONTEND_URL}/games/rivals/dashboard`));
            break;
        case 'duel_accepted':
            recipientId = payload.recipientDiscordId;
            embed = new EmbedBuilder().setColor(0x3fb950).setTitle('✅ Challenge Accepted!').setDescription(`**${payload.opponentUsername}** accepted your challenge. Start the match from your inbox.`).setFooter({ text: `Duel ID: ${payload.duelId}` });
            row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Go to Dashboard').setStyle(ButtonStyle.Link).setURL(`${FRONTEND_URL}/games/rivals/dashboard`));
            break;
        case 'duel_started':
            recipientId = payload.recipientDiscordId;
            embed = new EmbedBuilder().setColor(0xf85149).setTitle('🔥 Your Duel Has Started!').setDescription(`**${payload.starterUsername}** started the duel. Join now!`).setFooter({ text: `Duel ID: ${payload.duelId}` });
            row = new ActionRowBuilder().addComponents(new ButtonBuilder().setLabel('Join Server').setStyle(ButtonStyle.Link).setURL(payload.serverLink));
            break;
        default:
            throw new Error(`Unknown DM notification type: ${type}`);
    }

    if (!recipientId) throw new Error(`Recipient ID not found for DM type ${type}`);
    try {
        const user = await client.users.fetch(recipientId);
        await user.send({ embeds: [embed.setTimestamp()], components: row ? [row] : [] });
    } catch (dmError) {
        console.warn(`[DMs] Failed to send '${type}' DM to user ${recipientId}: ${dmError.message}`);
    }
}

module.exports = {
    handleDuelResult,
    handleDmNotification,
};
