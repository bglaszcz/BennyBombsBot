// Discord message link, e.g. https://discord.com/channels/<guild>/<channel>/<message>
const MESSAGE_LINK_REGEX = /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;

/** @returns {{ guildId: string, channelId: string, messageId: string } | null} */
function parseMessageLink(link) {
    const match = link.match(MESSAGE_LINK_REGEX);
    if (!match) return null;
    const [, guildId, channelId, messageId] = match;
    return { guildId, channelId, messageId };
}

/** @returns {Promise<import('discord.js').Message | null>} null if the channel or message is gone */
async function fetchMessage(client, channelId, messageId) {
    try {
        const channel = await client.channels.fetch(channelId);
        return await channel.messages.fetch(messageId);
    }
    catch {
        return null;
    }
}

/** Message text for storing/quoting, with placeholders for attachment-only posts */
function getMessageText(message, maxLength = 500) {
    let text = message.content;
    if (!text && message.attachments.size > 0) text = '[Attachment]';
    if (!text && message.embeds.length > 0) text = '[Embed]';
    if (!text) text = '[No text content]';
    return truncate(text, maxLength);
}

function truncate(text, maxLength) {
    return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

module.exports = { MESSAGE_LINK_REGEX, parseMessageLink, fetchMessage, getMessageText, truncate };
