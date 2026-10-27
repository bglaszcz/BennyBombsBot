const { EmbedBuilder } = require('discord.js');
const { OutOfContext } = require('../models');
const { getMessageText } = require('../utils/messages');

const SELF_DESTRUCT_MS = 5 * 60 * 1000;

/**
 * Save a message as an out-of-context quote.
 * @param {import('discord.js').Message} message - The message being quoted
 * @param {import('discord.js').User} addedBy
 * @returns {Promise<{ error: string } | { embed: EmbedBuilder }>}
 */
async function addQuote(message, addedBy) {
    if (message.author.id === addedBy.id) {
        return { error: "You can't quote yourself, that's just sad. 😬" };
    }
    if (message.author.bot) {
        return { error: 'Quoting bots? Really? Touch grass. 🌿' };
    }

    const quote = getMessageText(message);
    const newQuote = await OutOfContext.create({
        quote,
        quotedUserId: message.author.id,
        quotedUsername: message.author.username,
        addedByUserId: addedBy.id,
        addedByUsername: addedBy.username,
        guildId: message.guildId,
    });

    const embed = new EmbedBuilder()
        .setColor('#FF6B6B')
        .setTitle('📝 Quote Added!')
        .setDescription(`"${quote}"`)
        .addFields(
            { name: 'Said by', value: `<@${message.author.id}>`, inline: true },
            { name: 'Added by', value: `${addedBy}`, inline: true },
            { name: 'Quote ID', value: `#${newQuote.id}`, inline: true },
            { name: 'Message Link', value: `[Jump to message](${message.url})`, inline: true },
        )
        .setFooter({ text: 'No context allowed 🤫 • This message will self-destruct in 5 minutes' })
        .setTimestamp();

    return { embed };
}

/** Delete a bot reply after the standard self-destruct delay */
function selfDestruct(reply) {
    setTimeout(() => reply.delete().catch(() => {}), SELF_DESTRUCT_MS);
}

module.exports = { addQuote, selfDestruct };
