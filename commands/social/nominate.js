const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Sequelize, Op } = require('sequelize');
const sequelize = require('../../db.js');
const Nomination = require('../../models/Nomination')(sequelize, Sequelize.DataTypes);

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
	value: value,
}));

// Discord message link regex
const MESSAGE_LINK_REGEX = /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('nominate')
		.setDescription('Nominate messages for Goutcord Awards')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Nominate a message for an award')
				.addStringOption(option =>
					option
						.setName('award')
						.setDescription('Which award to nominate for')
						.setRequired(true)
						.addChoices(...AWARD_CHOICES)
				)
				.addStringOption(option =>
					option
						.setName('message_link')
						.setDescription('Discord message link (right-click message > Copy Message Link)')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('View nominations')
				.addStringOption(option =>
					option
						.setName('award')
						.setDescription('Filter by award type')
						.setRequired(false)
						.addChoices(...AWARD_CHOICES)
				)
				.addUserOption(option =>
					option
						.setName('user')
						.setDescription('Filter by nominee')
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('leaderboard')
				.setDescription('See who has the most nominations')
				.addStringOption(option =>
					option
						.setName('award')
						.setDescription('Filter by award type')
						.setRequired(false)
						.addChoices(...AWARD_CHOICES)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('delete')
				.setDescription('Delete your own nomination')
				.addIntegerOption(option =>
					option
						.setName('id')
						.setDescription('Nomination ID to delete')
						.setRequired(true)
				)
		),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const currentYear = new Date().getFullYear();

		if (subcommand === 'add') {
			const awardType = interaction.options.getString('award');
			const messageLink = interaction.options.getString('message_link');
			const award = AWARDS[awardType];

			// Validate message link format
			const match = messageLink.match(MESSAGE_LINK_REGEX);
			if (!match) {
				return interaction.reply({
					content: "That doesn't look like a valid Discord message link. Right-click a message and select 'Copy Message Link'. 🔗",
					ephemeral: true,
				});
			}

			const [, guildId, channelId, messageId] = match;

			// Check if link is from this server
			if (guildId !== interaction.guildId) {
				return interaction.reply({
					content: "That message is from a different server. Keep the nominations local! 🏠",
					ephemeral: true,
				});
			}

			await interaction.deferReply();

			try {
				// Fetch the channel and message
				const channel = await interaction.client.channels.fetch(channelId);
				if (!channel) {
					return interaction.editReply({
						content: "Couldn't find that channel. Maybe it was deleted? 👻",
					});
				}

				const message = await channel.messages.fetch(messageId);
				if (!message) {
					return interaction.editReply({
						content: "Couldn't find that message. It may have been deleted. 💨",
					});
				}

				// Prevent self-nomination
				if (message.author.id === interaction.user.id) {
					return interaction.editReply({
						content: "You can't nominate yourself. That's not how awards work. 🙄",
					});
				}

				// Prevent nominating bots
				if (message.author.bot) {
					return interaction.editReply({
						content: "Nominating bots? They don't deserve awards. 🤖",
					});
				}

				// Check for duplicate nomination (same nominator, same message, same award)
				const existing = await Nomination.findOne({
					where: {
						awardType: awardType,
						messageLink: messageLink,
						nominatorUserId: interaction.user.id,
						guildId: interaction.guildId,
						year: currentYear,
					},
				});

				if (existing) {
					return interaction.editReply({
						content: `You already nominated this message for ${award.emoji} ${award.name}! 📝`,
					});
				}

				// Get message content (handle empty content with attachments)
				let messageContent = message.content;
				if (!messageContent && message.attachments.size > 0) {
					messageContent = '[Attachment]';
				}
				if (!messageContent && message.embeds.length > 0) {
					messageContent = '[Embed]';
				}
				if (!messageContent) {
					messageContent = '[No text content]';
				}

				// Truncate if too long
				if (messageContent.length > 500) {
					messageContent = messageContent.substring(0, 497) + '...';
				}

				// Save the nomination
				const nomination = await Nomination.create({
					awardType: awardType,
					year: currentYear,
					messageLink: messageLink,
					messageContent: messageContent,
					nomineeUserId: message.author.id,
					nomineeUsername: message.author.username,
					nominatorUserId: interaction.user.id,
					nominatorUsername: interaction.user.username,
					guildId: interaction.guildId,
				});

				const embed = new EmbedBuilder()
					.setColor('#FFD700')
					.setTitle(`${award.emoji} Nomination Added!`)
					.setDescription(`"${messageContent}"`)
					.addFields(
						{ name: 'Award', value: award.name, inline: true },
						{ name: 'Nominee', value: `<@${message.author.id}>`, inline: true },
						{ name: 'Nominated by', value: `<@${interaction.user.id}>`, inline: true },
						{ name: 'Nomination ID', value: `#${nomination.id}`, inline: true },
						{ name: 'Message Link', value: `[Jump to message](${messageLink})`, inline: true }
					)
					.setFooter({ text: `Goutcord Awards ${currentYear}` })
					.setTimestamp();

				await interaction.editReply({ embeds: [embed] });
			} catch (error) {
				console.error('Error adding nomination:', error);
				await interaction.editReply({
					content: "Something went wrong while adding that nomination. The message might not be accessible. 😵",
				});
			}
		}

		else if (subcommand === 'list') {
			const awardType = interaction.options.getString('award');
			const filterUser = interaction.options.getUser('user');

			try {
				const whereClause = {
					guildId: interaction.guildId,
					year: currentYear,
				};

				if (awardType) {
					whereClause.awardType = awardType;
				}
				if (filterUser) {
					whereClause.nomineeUserId = filterUser.id;
				}

				const nominations = await Nomination.findAll({
					where: whereClause,
					order: [['createdAt', 'DESC']],
					limit: 10,
				});

				if (nominations.length === 0) {
					const filterText = [];
					if (awardType) filterText.push(AWARDS[awardType].name);
					if (filterUser) filterText.push(`@${filterUser.username}`);
					const filterMsg = filterText.length > 0 ? ` for ${filterText.join(' and ')}` : '';

					return interaction.reply({
						content: `No nominations found${filterMsg}. Time to nominate some bangers! 🎯`,
					});
				}

				const totalCount = await Nomination.count({ where: whereClause });

				const nominationList = nominations.map(n => {
					const award = AWARDS[n.awardType];
					const preview = n.messageContent.length > 50
						? n.messageContent.substring(0, 47) + '...'
						: n.messageContent;
					return `**#${n.id}** ${award.emoji} "${preview}"\n└ <@${n.nomineeUserId}> • [Link](${n.messageLink})`;
				}).join('\n\n');

				let title = `📋 Nominations ${currentYear}`;
				if (awardType) {
					title = `${AWARDS[awardType].emoji} ${AWARDS[awardType].name} Nominations`;
				}
				if (filterUser) {
					title += ` for ${filterUser.username}`;
				}

				const embed = new EmbedBuilder()
					.setColor('#3498DB')
					.setTitle(title)
					.setDescription(nominationList)
					.setFooter({ text: `Showing ${nominations.length} of ${totalCount} nominations` })
					.setTimestamp();

				await interaction.reply({ embeds: [embed] });
			} catch (error) {
				console.error('Error listing nominations:', error);
				await interaction.reply({
					content: 'Failed to fetch nominations. Try again later. 😓',
					ephemeral: true,
				});
			}
		}

		else if (subcommand === 'leaderboard') {
			const awardType = interaction.options.getString('award');

			try {
				const whereClause = {
					guildId: interaction.guildId,
					year: currentYear,
				};

				if (awardType) {
					whereClause.awardType = awardType;
				}

				const leaderboard = await Nomination.findAll({
					where: whereClause,
					attributes: [
						'nomineeUserId',
						'nomineeUsername',
						[sequelize.fn('COUNT', sequelize.col('nomineeUserId')), 'nominationCount'],
					],
					group: ['nomineeUserId', 'nomineeUsername'],
					order: [[sequelize.literal('nominationCount'), 'DESC']],
					limit: 10,
				});

				if (leaderboard.length === 0) {
					return interaction.reply({
						content: `No nominations yet for ${currentYear}. Be the first to nominate! 🏆`,
					});
				}

				const medals = ['🥇', '🥈', '🥉'];
				const leaderboardText = leaderboard.map((entry, index) => {
					const medal = medals[index] || `**${index + 1}.**`;
					const count = entry.dataValues.nominationCount;
					return `${medal} <@${entry.nomineeUserId}> - **${count}** nomination${count !== 1 ? 's' : ''}`;
				}).join('\n');

				const totalNominations = await Nomination.count({ where: whereClause });

				let title = `🏆 Goutcord Awards Leaderboard ${currentYear}`;
				let color = '#F1C40F';
				if (awardType) {
					const award = AWARDS[awardType];
					title = `${award.emoji} ${award.name} Leaderboard`;
					color = '#FFD700';
				}

				const embed = new EmbedBuilder()
					.setColor(color)
					.setTitle(title)
					.setDescription(leaderboardText)
					.setFooter({ text: `${totalNominations} total nominations` })
					.setTimestamp();

				await interaction.reply({ embeds: [embed] });
			} catch (error) {
				console.error('Error fetching leaderboard:', error);
				await interaction.reply({
					content: 'Leaderboard machine broke. 🔧',
					ephemeral: true,
				});
			}
		}

		else if (subcommand === 'delete') {
			const nominationId = interaction.options.getInteger('id');

			try {
				const nomination = await Nomination.findOne({
					where: {
						id: nominationId,
						guildId: interaction.guildId,
					},
				});

				if (!nomination) {
					return interaction.reply({
						content: `Nomination #${nominationId} doesn't exist. 🔍`,
						ephemeral: true,
					});
				}

				if (nomination.nominatorUserId !== interaction.user.id) {
					return interaction.reply({
						content: `Only ${nomination.nominatorUsername} can delete this nomination. 🚫`,
						ephemeral: true,
					});
				}

				const award = AWARDS[nomination.awardType];
				await nomination.destroy();

				await interaction.reply({
					content: `${award.emoji} Nomination #${nominationId} has been deleted. 🗑️`,
				});
			} catch (error) {
				console.error('Error deleting nomination:', error);
				await interaction.reply({
					content: 'Failed to delete nomination. Try again later. 😵',
					ephemeral: true,
				});
			}
		}
	},
};
