const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { OutOfContext, sequelize } = require('../../models');
const { addQuote, selfDestruct } = require('../../services/outOfContext');
const { parseMessageLink, fetchMessage, truncate } = require('../../utils/messages');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('outofcontext')
		.setDescription('Save and retrieve hilarious out-of-context quotes')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Add a quote (or right-click a message > Apps > Add to Out of Context)')
				.addStringOption(option =>
					option
						.setName('message_link')
						.setDescription('Discord message link (right-click message > Copy Message Link)')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('random')
				.setDescription('Get a random out-of-context quote')
				.addUserOption(option =>
					option
						.setName('user')
						.setDescription('Filter by a specific user (optional)')
						.setRequired(false)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('list')
				.setDescription('List quotes from a user')
				.addUserOption(option =>
					option
						.setName('user')
						.setDescription('Whose quotes to list')
						.setRequired(true)
				)
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('leaderboard')
				.setDescription('See who\'s been quoted the most')
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('delete')
				.setDescription('Delete a quote by ID (only if you added it)')
				.addIntegerOption(option =>
					option
						.setName('id')
						.setDescription('The quote ID to delete')
						.setRequired(true)
				)
		),

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();

		if (subcommand === 'add') {
			const link = parseMessageLink(interaction.options.getString('message_link'));

			if (!link) {
				return interaction.reply({
					content: "That doesn't look like a valid Discord message link. Right-click a message and select 'Copy Message Link'. 🔗",
					flags: MessageFlags.Ephemeral,
				});
			}

			if (link.guildId !== interaction.guildId) {
				return interaction.reply({
					content: "That message is from a different server. Keep the quotes local! 🏠",
					flags: MessageFlags.Ephemeral,
				});
			}

			await interaction.deferReply();

			try {
				const message = await fetchMessage(interaction.client, link.channelId, link.messageId);
				if (!message) {
					return interaction.editReply("Couldn't find that message. It may have been deleted. 💨");
				}

				const result = await addQuote(message, interaction.user);
				if (result.error) return interaction.editReply(result.error);

				const reply = await interaction.editReply({ embeds: [result.embed] });
				selfDestruct(reply);
			}
			catch (error) {
				console.error('Error adding quote:', error);
				await interaction.editReply({
					content: 'Something broke while saving that quote. Probably your fault. 🙄',
				});
			}
		}

		else if (subcommand === 'random') {
			const filterUser = interaction.options.getUser('user');

			try {
				const whereClause = { guildId: interaction.guildId };
				if (filterUser) {
					whereClause.quotedUserId = filterUser.id;
				}

				const quote = await OutOfContext.findOne({
					where: whereClause,
					order: sequelize.random(),
				});

				if (!quote) {
					const message = filterUser
						? `No quotes found for ${filterUser.username}. They must be boring. 😴`
						: "No quotes yet! Y'all need to say more unhinged things. 🤪";
					return interaction.reply({ content: message });
				}

				const embed = new EmbedBuilder()
					.setColor('#9B59B6')
					.setTitle('🎲 Random Out-of-Context Quote')
					.setDescription(`"${quote.quote}"`)
					.addFields(
						{ name: 'Said by', value: `<@${quote.quotedUserId}>`, inline: true },
						{ name: 'Quote ID', value: `#${quote.id}`, inline: true }
					)
					.setFooter({ text: `Added by ${quote.addedByUsername}` })
					.setTimestamp(quote.createdAt);

				await interaction.reply({ embeds: [embed] });
			} catch (error) {
				console.error('Error fetching random quote:', error);
				await interaction.reply({
					content: 'Failed to fetch a quote. The database is judging you. 👀',
					flags: MessageFlags.Ephemeral,
				});
			}
		}

		else if (subcommand === 'list') {
			const targetUser = interaction.options.getUser('user');

			try {
				const quotes = await OutOfContext.findAll({
					where: {
						guildId: interaction.guildId,
						quotedUserId: targetUser.id,
					},
					order: [['createdAt', 'DESC']],
					limit: 10,
				});

				if (quotes.length === 0) {
					return interaction.reply({
						content: `No quotes found for ${targetUser.username}. Suspiciously normal... 🤔`,
					});
				}

				const totalCount = await OutOfContext.count({
					where: {
						guildId: interaction.guildId,
						quotedUserId: targetUser.id,
					},
				});

				const quoteList = quotes
					.map(q => `**#${q.id}** "${truncate(q.quote, 300)}"`)
					.join('\n\n');

				const embed = new EmbedBuilder()
					.setColor('#3498DB')
					.setTitle(`📜 Quotes from ${targetUser.username}`)
					.setThumbnail(targetUser.displayAvatarURL())
					.setDescription(quoteList)
					.setFooter({ text: `Showing ${quotes.length} of ${totalCount} total quotes` });

				await interaction.reply({ embeds: [embed] });
			} catch (error) {
				console.error('Error listing quotes:', error);
				await interaction.reply({
					content: 'Failed to list quotes. Try again when Mercury is out of retrograde. 🌙',
					flags: MessageFlags.Ephemeral,
				});
			}
		}

		else if (subcommand === 'leaderboard') {
			try {
				const leaderboard = await OutOfContext.findAll({
					where: { guildId: interaction.guildId },
					attributes: [
						'quotedUserId',
						[sequelize.fn('COUNT', sequelize.col('quotedUserId')), 'quoteCount'],
					],
					group: ['quotedUserId'],
					// Quoted: Postgres folds unquoted identifiers to lowercase
					order: [[sequelize.literal('"quoteCount"'), 'DESC']],
					limit: 10,
				});

				if (leaderboard.length === 0) {
					return interaction.reply({
						content: "No quotes yet! This server is disappointingly normal. 😐",
					});
				}

				const medals = ['🥇', '🥈', '🥉'];
				const leaderboardText = leaderboard
					.map((entry, index) => {
						const medal = medals[index] || `**${index + 1}.**`;
						const count = Number(entry.dataValues.quoteCount);
						return `${medal} <@${entry.quotedUserId}> - **${count}** quote${count !== 1 ? 's' : ''}`;
					})
					.join('\n');

				const totalQuotes = await OutOfContext.count({
					where: { guildId: interaction.guildId },
				});

				const embed = new EmbedBuilder()
					.setColor('#F1C40F')
					.setTitle('🏆 Out-of-Context Hall of Fame')
					.setDescription(leaderboardText)
					.setFooter({ text: `${totalQuotes} total quotes in this server` })
					.setTimestamp();

				await interaction.reply({ embeds: [embed] });
			} catch (error) {
				console.error('Error fetching leaderboard:', error);
				await interaction.reply({
					content: 'Leaderboard machine broke. 🔧',
					flags: MessageFlags.Ephemeral,
				});
			}
		}

		else if (subcommand === 'delete') {
			const quoteId = interaction.options.getInteger('id');

			try {
				const quote = await OutOfContext.findOne({
					where: {
						id: quoteId,
						guildId: interaction.guildId,
					},
				});

				if (!quote) {
					return interaction.reply({
						content: `Quote #${quoteId} doesn't exist. Nice try though. 🕵️`,
						flags: MessageFlags.Ephemeral,
					});
				}

				// Only the person who added it can delete it
				if (quote.addedByUserId !== interaction.user.id) {
					return interaction.reply({
						content: `Only ${quote.addedByUsername} can delete this quote. No quote theft allowed. 🚫`,
						flags: MessageFlags.Ephemeral,
					});
				}

				await quote.destroy();

				await interaction.reply({
					content: `Quote #${quoteId} has been yeeted into the void. 🕳️`,
				});
			} catch (error) {
				console.error('Error deleting quote:', error);
				await interaction.reply({
					content: 'Failed to delete. The quote has become too powerful. 💀',
					flags: MessageFlags.Ephemeral,
				});
			}
		}
	},
};
