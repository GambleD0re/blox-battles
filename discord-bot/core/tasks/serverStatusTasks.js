// discord-bot/core/tasks/serverStatusTasks.js
const { EmbedBuilder } = require('discord.js');

const regionConfig = {
    'NA-East': {
        roleId: process.env.RIVALS_NA_EAST_ROLE_ID,
        vcId: process.env.NA_EAST_VC_ID,
        fullName: 'NA-East'
    },
    'NA-West': {
        roleId: process.env.RIVALS_NA_WEST_ROLE_ID,
        vcId: process.env.NA_WEST_VC_ID,
        fullName: 'NA-West'
    },
    'EU': {
        roleId: process.env.RIVALS_EU_ROLE_ID,
        vcId: process.env.EUROPE_VC_ID,
        fullName: 'Europe'
    },
    'OCE': {
        roleId: process.env.RIVALS_OCE_ROLE_ID,
        vcId: process.env.OCE_VC_ID,
        fullName: 'Oceania'
    }
};

async function handleServerStatusUpdate(client, task) {
    const { region, status, silent } = task.payload;
    const config = regionConfig[region];
    const pingChannelId = process.env.STATUS_PINGS_CHANNEL_ID;

    if (!config || !pingChannelId) {
        console.warn(`[StatusUpdate] Missing configuration for region "${region}" or status pings channel.`);
        return;
    }

    try {
        const pingChannel = await client.channels.fetch(pingChannelId);
        const voiceChannel = await client.channels.fetch(config.vcId);

        if (!pingChannel || !voiceChannel) {
            throw new Error(`Ping channel or VC not found for region ${region}`);
        }

        const isOnline = status === 'online';
        
        const nameParts = voiceChannel.name.split('|').map(p => p.trim());
        const baseName = nameParts.length > 1 ? nameParts[1] : config.fullName;
        const newStatusEmoji = isOnline ? '🟢' : '🔴';
        const newChannelName = `${newStatusEmoji} | ${baseName}`;

        if (voiceChannel.name !== newChannelName) {
            await voiceChannel.setName(newChannelName, `Server status changed to ${status}`);
        }

        if (silent) {
            console.log(`[StatusUpdate] Silently synced status for ${region} to ${status}.`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`Rivals Server Status Update`)
            .setTimestamp();

        if (isOnline) {
            embed
                .setColor(0x3BA55D)
                .setDescription(`🟢 The **${config.fullName}** region is now **online**!`);
        } else {
            embed
                .setColor(0xED4245)
                .setDescription(`🔴 The **${config.fullName}** region has gone **offline**.`);
        }

        await pingChannel.send({ content: `<@&${config.roleId}>`, embeds: [embed] });
        console.log(`[StatusUpdate] Announced status for ${region} is now ${status}.`);

    } catch (error) {
        console.error(`[StatusUpdate] Failed to process status update for region ${region}:`, error);
    }
}

module.exports = { handleServerStatusUpdate };
