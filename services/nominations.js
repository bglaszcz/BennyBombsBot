const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { Nomination } = require('../models');
const { fetchMessage, getMessageText } = require('../utils/messages');

// Award categories - easy to add/remove
const AWARDS = {
    cap: { name: 'Cap of the Year', emoji: '🧢', description: 'Most unbelievable comment' },
    gig: { name: 'Gig of the Year', emoji: '😂', description: 'Funniest joke' },
    mom: { name: 'Mom Joke of the Year', emoji: '👩', description: 'Best mom joke' },
    deez: { name: 'Deez Nuts of the Year', emoji: '🥜', description: 'Best deez nuts joke' },
    fish: { name: 'Fish of the Year', emoji: '🐟', description: 'Best fish moment' },
};

const AWARD_CHOICES = Object.entries(AWARDS).map(([value, award]) => ({
    name: `${award.emoji} ${award.name}`,
    value,
}));

/**
 * Nominate a message for an award.
 * @param {import('discord.js').Message} message
 * @param {string} awardType - Key of AWARDS
 * @param {import('discord.js').User} nominator
 * @returns {Promise<{ error: string } | { embed: EmbedBuilder }>}
 */
async function addNomination(message, awardType, nominator) {
    const award = AWARDS[awardType];

    if (message.author.id === nominator.id) {
        return { error: "You can't nominate yourself. That's not how awards work. 🙄" };
    }
    if (message.author.bot) {
        return { error: "Nominating bots? They don't deserve awards. 🤖" };
    }

    // Awards are for the year the message was sent
    const year = message.createdAt.getFullYear();

    const existing = await Nomination.findOne({
        where: { awardType, messageLink: message.url, guildId: message.guildId, year },
    });
    if (existing) {
        return { error: `This message has already been nominated for ${award.emoji} ${award.name} by <@${existing.nominatorUserId}>! 📝` };
    }

    const messageContent = getMessageText(message);
    const nomination = await Nomination.create({
        awardType,
        year,
        messageLink: message.url,
        messageContent,
        nomineeUserId: message.author.id,
        nomineeUsername: message.author.username,
        nominatorUserId: nominator.id,
        nominatorUsername: nominator.username,
        guildId: message.guildId,
    });

    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle(`${award.emoji} Nomination Added!`)
        .setDescription(`"${messageContent}"`)
        .addFields(
            { name: 'Award', value: award.name, inline: true },
            { name: 'Nominee', value: `<@${message.author.id}>`, inline: true },
            { name: 'Nominated by', value: `<@${nominator.id}>`, inline: true },
            { name: 'Nomination ID', value: `#${nomination.id}`, inline: true },
            { name: 'Message Link', value: `[Jump to message](${message.url})`, inline: true },
        )
        .setFooter({ text: `Goutcord Awards ${year}` })
        .setTimestamp();

    return { embed };
}

/** Ephemeral award picker for a specific message (used by the context menu and starboard button) */
function awardPickerPayload(channelId, messageId) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`nominate-award:${channelId}:${messageId}`)
        .setPlaceholder('Pick an award')
        .addOptions(Object.entries(AWARDS).map(([value, award]) => ({
            label: award.name,
            description: award.description,
            emoji: award.emoji,
            value,
        })));

    return {
        content: 'Which award is this message up for? 🏆',
        components: [new ActionRowBuilder().addComponents(select)],
        flags: MessageFlags.Ephemeral,
    };
}

/** Component handler for "nominate-start:<channelId>:<messageId>" buttons */
async function handleNominateStart(interaction) {
    const [, channelId, messageId] = interaction.customId.split(':');
    await interaction.reply(awardPickerPayload(channelId, messageId));
}

/** Component handler for the "nominate-award:<channelId>:<messageId>" select menu */
async function handleAwardSelect(interaction) {
    const [, channelId, messageId] = interaction.customId.split(':');
    const awardType = interaction.values[0];

    const message = await fetchMessage(interaction.client, channelId, messageId);
    if (!message) {
        await interaction.update({ content: "Couldn't find that message anymore. 💨", components: [] });
        return;
    }

    const result = await addNomination(message, awardType, interaction.user);
    if (result.error) {
        await interaction.update({ content: result.error, components: [] });
        return;
    }

    await interaction.update({ content: `${AWARDS[awardType].emoji} Nominated!`, components: [] });
    // Announce publicly — the picker itself was ephemeral
    await interaction.followUp({ embeds: [result.embed] });
}

module.exports = {
    AWARDS,
    AWARD_CHOICES,
    addNomination,
    awardPickerPayload,
    handleNominateStart,
    handleAwardSelect,
};
