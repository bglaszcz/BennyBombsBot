const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { Nomination, sequelize } = require('../../models');
const { AWARDS, AWARD_CHOICES, addNomination, handleNominateStart, handleAwardSelect } = require('../../services/nominations');
const { getState, setState } = require('../../services/botState');
const { parseMessageLink, fetchMessage, truncate } = require('../../utils/messages');
const { getNickname } = require('../../utils/getNickname');

// Discord poll limits
const MAX_POLL_ANSWERS = 10;
const MAX_POLL_ANSWER_LENGTH = 55;

const pollStateKey = (guildId, year) => `awards-polls:${guildId}:${year}`;

async function handleAdd(interaction) {
	const awardType = interaction.options.getString('award');
	const link = parseMessageLink(interaction.options.getString('message_link'));

	if (!link) {
		return interaction.reply({
			content: "That doesn't look like a valid Discord message link. Right-click a message and select 'Copy Message Link'. 🔗",
			flags: MessageFlags.Ephemeral,
		});
	}
	if (link.guildId !== interaction.guildId) {
		return interaction.reply({
			content: 'That message is from a different server. Keep the nominations local! 🏠',
			flags: MessageFlags.Ephemeral,
		});
	}

	await interaction.deferReply();

	const message = await fetchMessage(interaction.client, link.channelId, link.messageId);
	if (!message) {
		return interaction.editReply("Couldn't find that message. It may have been deleted. 💨");
	}

	const result = await addNomination(message, awardType, interaction.user);
	if (result.error) return interaction.editReply(result.error);
	return interaction.editReply({ embeds: [result.embed] });
}

async function handleList(interaction, currentYear) {
	const awardType = interaction.options.getString('award');
	const filterUser = interaction.options.getUser('user');
	const year = interaction.options.getInteger('year') || currentYear;

	const whereClause = { guildId: interaction.guildId, year };
	if (awardType) whereClause.awardType = awardType;
	if (filterUser) whereClause.nomineeUserId = filterUser.id;

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
		return interaction.reply(`No nominations found${filterMsg} in ${year}. Time to nominate some bangers! 🎯`);
	}

	const totalCount = await Nomination.count({ where: whereClause });

	const nominationList = nominations.map(n => {
		const award = AWARDS[n.awardType];
		return `**#${n.id}** ${award.emoji} "${truncate(n.messageContent, 50)}"\n└ <@${n.nomineeUserId}> • [Link](${n.messageLink})`;
	}).join('\n\n');

	let title = `📋 Nominations ${year}`;
	if (awardType) title = `${AWARDS[awardType].emoji} ${AWARDS[awardType].name} Nominations ${year}`;
	if (filterUser) title += ` for ${filterUser.username}`;

	const embed = new EmbedBuilder()
		.setColor('#3498DB')
		.setTitle(title)
		.setDescription(nominationList)
		.setFooter({ text: `Showing ${nominations.length} of ${totalCount} nominations` })
		.setTimestamp();

	return interaction.reply({ embeds: [embed] });
}

async function handleLeaderboard(interaction, currentYear) {
	const awardType = interaction.options.getString('award');
	const year = interaction.options.getInteger('year') || currentYear;

	const whereClause = { guildId: interaction.guildId, year };
	if (awardType) whereClause.awardType = awardType;

	const leaderboard = await Nomination.findAll({
		where: whereClause,
		attributes: [
			'nomineeUserId',
			[sequelize.fn('COUNT', sequelize.col('nomineeUserId')), 'nominationCount'],
		],
		group: ['nomineeUserId'],
		order: [[sequelize.literal('"nominationCount"'), 'DESC']],
		limit: 10,
	});

	if (leaderboard.length === 0) {
		return interaction.reply(`No nominations yet for ${year}. Be the first to nominate! 🏆`);
	}

	const medals = ['🥇', '🥈', '🥉'];
	const leaderboardText = leaderboard.map((entry, index) => {
		const count = Number(entry.dataValues.nominationCount);
		return `${medals[index] || '🏅'} <@${entry.nomineeUserId}> - **${count}** nomination${count !== 1 ? 's' : ''}`;
	}).join('\n');

	const totalNominations = await Nomination.count({ where: whereClause });

	const award = awardType ? AWARDS[awardType] : null;
	const embed = new EmbedBuilder()
		.setColor(award ? '#FFD700' : '#F1C40F')
		.setTitle(award ? `${award.emoji} ${award.name} Leaderboard ${year}` : `🏆 Goutcord Awards Leaderboard ${year}`)
		.setDescription(leaderboardText)
		.setFooter({ text: `${totalNominations} total nominations` })
		.setTimestamp();

	return interaction.reply({ embeds: [embed] });
}

async function handleDelete(interaction) {
	const nominationId = interaction.options.getInteger('id');

	const nomination = await Nomination.findOne({
		where: { id: nominationId, guildId: interaction.guildId },
	});

	if (!nomination) {
		return interaction.reply({ content: `Nomination #${nominationId} doesn't exist. 🔍`, flags: MessageFlags.Ephemeral });
	}
	if (nomination.nominatorUserId !== interaction.user.id) {
		return interaction.reply({
			content: `Only ${nomination.nominatorUsername} can delete this nomination. 🚫`,
			flags: MessageFlags.Ephemeral,
		});
	}

	await nomination.destroy();
	return interaction.reply(`${AWARDS[nomination.awardType].emoji} Nomination #${nominationId} has been deleted. 🗑️`);
}

function requireManageGuild(interaction) {
	if (interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
	interaction.reply({ content: 'You need the **Manage Server** permission to run the awards. 🎩', flags: MessageFlags.Ephemeral });
	return false;
}

/** Open one native Discord poll per award category, built from that year's nominations */
async function handlePolls(interaction, currentYear) {
	if (!requireManageGuild(interaction)) return;

	const year = interaction.options.getInteger('year') || currentYear;
	const hours = interaction.options.getInteger('hours') || 72;

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const polls = [];
	const notes = [];

	for (const [awardType, award] of Object.entries(AWARDS)) {
		const nominations = await Nomination.findAll({
			where: { guildId: interaction.guildId, year, awardType },
			order: [['createdAt', 'ASC']],
		});
		if (nominations.length === 0) continue;

		const contenders = nominations.slice(0, MAX_POLL_ANSWERS);
		if (nominations.length > MAX_POLL_ANSWERS) {
			notes.push(`${award.emoji} ${award.name}: only the first ${MAX_POLL_ANSWERS} of ${nominations.length} nominations fit in a poll`);
		}

		const message = await interaction.channel.send({
			poll: {
				question: { text: `${award.emoji} ${award.name} ${year} — ${award.description}` },
				answers: contenders.map(n => ({
					text: truncate(`${getNickname(n.nomineeUserId, n.nomineeUsername)}: "${n.messageContent}"`, MAX_POLL_ANSWER_LENGTH),
				})),
				duration: hours,
				allowMultiselect: false,
			},
		});

		// Poll answer IDs are 1-based in the order we sent them
		polls.push({ awardType, channelId: message.channelId, messageId: message.id, nominationIds: contenders.map(n => n.id) });
	}

	if (polls.length === 0) {
		return interaction.editReply(`No nominations for ${year}, so there's nothing to vote on. 🦗`);
	}

	await setState(pollStateKey(interaction.guildId, year), polls);

	return interaction.editReply(
		`🗳️ Opened ${polls.length} award poll${polls.length !== 1 ? 's' : ''} for ${year}, closing in ${hours} hours.\n` +
		`Run \`/nominate results\` to crown the winners.` +
		(notes.length > 0 ? `\n\n⚠️ ${notes.join('\n⚠️ ')}` : ''),
	);
}

/** Read vote counts off the award polls and announce the winners */
async function handleResults(interaction, currentYear) {
	const year = interaction.options.getInteger('year') || currentYear;
	const polls = await getState(pollStateKey(interaction.guildId, year));

	if (!polls) {
		return interaction.reply({ content: `No award polls have been opened for ${year}. Use \`/nominate polls\` first.`, flags: MessageFlags.Ephemeral });
	}

	await interaction.deferReply();

	const embed = new EmbedBuilder()
		.setColor('#FFD700')
		.setTitle(`🏆 Goutcord Awards ${year} — Winners`)
		.setTimestamp();

	let allFinal = true;

	for (const poll of polls) {
		const award = AWARDS[poll.awardType];
		const message = await fetchMessage(interaction.client, poll.channelId, poll.messageId);
		if (!message?.poll) {
			embed.addFields({ name: `${award.emoji} ${award.name}`, value: '*Poll message is gone* 👻' });
			continue;
		}
		if (!message.poll.resultsFinalized) allFinal = false;

		const counts = [...message.poll.answers.values()].map(a => ({ answerId: a.id, votes: a.voteCount ?? 0 }));
		const topVotes = Math.max(0, ...counts.map(c => c.votes));
		if (topVotes === 0) {
			embed.addFields({ name: `${award.emoji} ${award.name}`, value: 'No votes yet 🦗' });
			continue;
		}

		const winnerIds = counts.filter(c => c.votes === topVotes).map(c => poll.nominationIds[c.answerId - 1]);
		const winners = await Nomination.findAll({ where: { id: winnerIds } });
		const lines = winners.map(w => `<@${w.nomineeUserId}> — "${truncate(w.messageContent, 120)}" [↗](${w.messageLink})`);

		embed.addFields({
			name: `${award.emoji} ${award.name}${winners.length > 1 ? ' (tie!)' : ''} — ${topVotes} vote${topVotes !== 1 ? 's' : ''}`,
			value: lines.join('\n'),
		});
	}

	if (!allFinal) embed.setDescription('*Some polls are still open — these are the standings so far.*');

	return interaction.editReply({ embeds: [embed] });
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('nominate')
		.setDescription('Nominate messages for Goutcord Awards')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Nominate a message for an award (or right-click a message > Apps > Nominate for Award)')
				.addStringOption(option =>
					option
						.setName('award')
						.setDescription('Which award to nominate for')
						.setRequired(true)
						.addChoices(...AWARD_CHOICES),
				)
				.addStringOption(option =>
					option
						.setName('message_link')
						.setDescription('Discord message link (right-click message > Copy Message Link)')
						.setRequired(true),
				),
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
						.addChoices(...AWARD_CHOICES),
				)
				.addUserOption(option =>
					option
						.setName('user')
						.setDescription('Filter by nominee')
						.setRequired(false),
				)
				.addIntegerOption(option =>
					option
						.setName('year')
						.setDescription('Year to view (defaults to current year)')
						.setRequired(false),
				),
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
						.addChoices(...AWARD_CHOICES),
				)
				.addIntegerOption(option =>
					option
						.setName('year')
						.setDescription('Year to view (defaults to current year)')
						.setRequired(false),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('delete')
				.setDescription('Delete your own nomination')
				.addIntegerOption(option =>
					option
						.setName('id')
						.setDescription('Nomination ID to delete')
						.setRequired(true),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('polls')
				.setDescription('(Manage Server) Open a voting poll for every award category')
				.addIntegerOption(option =>
					option
						.setName('year')
						.setDescription('Awards year (defaults to current year)')
						.setRequired(false),
				)
				.addIntegerOption(option =>
					option
						.setName('hours')
						.setDescription('How long voting stays open (default 72)')
						.setMinValue(1)
						.setMaxValue(768)
						.setRequired(false),
				),
		)
		.addSubcommand(subcommand =>
			subcommand
				.setName('results')
				.setDescription('Announce the award winners from the voting polls')
				.addIntegerOption(option =>
					option
						.setName('year')
						.setDescription('Awards year (defaults to current year)')
						.setRequired(false),
				),
		),

	components: {
		'nominate-start': handleNominateStart,
		'nominate-award': handleAwardSelect,
	},

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		const currentYear = new Date().getFullYear();

		if (subcommand === 'add') return handleAdd(interaction);
		if (subcommand === 'list') return handleList(interaction, currentYear);
		if (subcommand === 'leaderboard') return handleLeaderboard(interaction, currentYear);
		if (subcommand === 'delete') return handleDelete(interaction);
		if (subcommand === 'polls') return handlePolls(interaction, currentYear);
		if (subcommand === 'results') return handleResults(interaction, currentYear);
	},
};
