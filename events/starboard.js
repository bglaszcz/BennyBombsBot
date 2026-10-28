const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { UniqueConstraintError } = require('sequelize');
const { StarboardPost } = require('../models');
const settings = require('../config/settings');
const { truncate } = require('../utils/messages');

function buildStarboardEmbed(message, emoji, count) {
	const embed = new EmbedBuilder()
		.setColor(0xFFAC33)
		.setAuthor({ name: message.member?.displayName || message.author.username, iconURL: message.author.displayAvatarURL() })
		.setDescription(message.content ? truncate(message.content, 4000) : null)
		.addFields({ name: 'Source', value: `[Jump to message](${message.url}) in ${message.channel}` })
		.setFooter({ text: `${emoji} ${count}` })
		.setTimestamp(message.createdAt);

	const image = message.attachments.find(a => a.contentType?.startsWith('image/'));
	if (image) embed.setImage(image.url);

	return embed;
}

module.exports = {
	name: Events.MessageReactionAdd,
	async execute(reaction, user) {
		const { starboard: starboardChannelId } = settings.channels;
		if (!starboardChannelId || user.bot) return;

		const emoji = reaction.emoji.name;
		if (!settings.starboard.emojis.includes(emoji)) return;

		// Reactions on messages from before the bot started arrive partially
		if (reaction.partial) await reaction.fetch();
		const message = reaction.message.partial ? await reaction.message.fetch() : reaction.message;

		if (!message.guild || message.author.bot) return;
		if (message.channelId === starboardChannelId) return;
		if (reaction.count < settings.starboard.threshold) return;

		// Claim the message first — the unique key stops two reactions racing into a double post
		let post;
		try {
			post = await StarboardPost.create({
				messageId: message.id,
				channelId: message.channelId,
				authorId: message.author.id,
			});
		}
		catch (error) {
			if (error instanceof UniqueConstraintError) return;
			throw error;
		}

		const buttons = new ActionRowBuilder().addComponents(
			new ButtonBuilder()
				.setCustomId(`nominate-start:${message.channelId}:${message.id}`)
				.setLabel('Nominate for an award')
				.setEmoji('🏆')
				.setStyle(ButtonStyle.Primary),
			new ButtonBuilder()
				.setURL(message.url)
				.setLabel('Jump')
				.setStyle(ButtonStyle.Link),
		);

		const starboardChannel = await message.client.channels.fetch(starboardChannelId);
		const starboardMessage = await starboardChannel.send({
			content: `${emoji} **${reaction.count}** — <@${message.author.id}> made the hall of fame`,
			embeds: [buildStarboardEmbed(message, emoji, reaction.count)],
			components: [buttons],
			allowedMentions: { parse: [] },
		});

		await post.update({ starboardMessageId: starboardMessage.id });
	},
};
