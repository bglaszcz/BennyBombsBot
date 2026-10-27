const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Op } = require('sequelize');
const {
	User, LevelUpMessage, WordleScore, MapTapScore, GMCMessage, GACMessage,
	OutOfContext, Nomination, BootJaf, DethTootLog, GACBet,
} = require('../../models');
const { AWARDS } = require('../../services/nominations');
const { generateText } = require('../../services/gemini');
const { calculateStreaks } = require('../../utils/wordle');
const { getNickname } = require('../../utils/getNickname');

/**
 * Gather everything we know about one user for one calendar year.
 */
async function gatherStats(user, year) {
	const start = new Date(year, 0, 1);
	const end = new Date(year + 1, 0, 1);
	const inYear = { [Op.gte]: start, [Op.lt]: end };
	const byId = { userId: user.id };

	const [
		xpUser, levelUps, wordle, maptap, gmcs, gacs, quotedCount, quotesAdded,
		nominations, nominationsGiven, boots, toots, betNet,
	] = await Promise.all([
		User.findByPk(user.id),
		LevelUpMessage.count({ where: { ...byId, timestamp: { [Op.gte]: start.getTime(), [Op.lt]: end.getTime() } } }),
		WordleScore.findAll({ where: { ...byId, postedAt: inYear }, order: [['wordleNumber', 'DESC']], raw: true }),
		MapTapScore.findAll({ where: { ...byId, postedAt: inYear }, raw: true }),
		GMCMessage.count({ where: { ...byId, createdAt: inYear } }),
		GACMessage.count({ where: { ...byId, createdAt: inYear } }),
		OutOfContext.count({ where: { quotedUserId: user.id, createdAt: inYear } }),
		OutOfContext.count({ where: { addedByUserId: user.id, createdAt: inYear } }),
		Nomination.findAll({ where: { nomineeUserId: user.id, year }, attributes: ['awardType'], raw: true }),
		Nomination.count({ where: { nominatorUserId: user.id, year } }),
		BootJaf.count({ where: { ...byId, createdAt: inYear } }),
		DethTootLog.count({ where: { ...byId, tootedAt: inYear } }),
		GACBet.sum('payout', { where: { ...byId, resolved: true, createdAt: inYear } }),
	]);

	let xpRank = null;
	if (xpUser) {
		const ahead = await User.count({
			where: {
				[Op.or]: [
					{ level: { [Op.gt]: xpUser.level } },
					{ level: xpUser.level, xp: { [Op.gt]: xpUser.xp } },
				],
			},
		});
		xpRank = ahead + 1;
	}

	const wordleWins = wordle.filter(s => s.score <= 6);
	const nominationsByAward = {};
	for (const n of nominations) nominationsByAward[n.awardType] = (nominationsByAward[n.awardType] || 0) + 1;

	return {
		level: xpUser?.level ?? null,
		xpRank,
		levelUps,
		wordle: wordle.length === 0 ? null : {
			games: wordle.length,
			winRate: Math.round((wordleWins.length / wordle.length) * 100),
			avg: wordleWins.length ? (wordleWins.reduce((a, s) => a + s.score, 0) / wordleWins.length).toFixed(2) : null,
			holeInOnes: wordle.filter(s => s.score === 1).length,
			bestStreak: calculateStreaks(wordle).bestStreak,
		},
		maptap: maptap.length === 0 ? null : {
			games: maptap.length,
			avg: Math.round(maptap.reduce((a, s) => a + s.finalScore, 0) / maptap.length),
			best: Math.max(...maptap.map(s => s.finalScore)),
		},
		gmcs,
		gacs,
		quotedCount,
		quotesAdded,
		nominationsByAward,
		nominationsReceived: nominations.length,
		nominationsGiven,
		boots,
		toots,
		betNet: betNet || 0,
	};
}

const times = n => `**${n}** time${n !== 1 ? 's' : ''}`;

async function writeRoast(name, year, stats) {
	const prompt = `You're writing the closing line of a "Spotify Wrapped"-style year in review for ${name}, a member of a close-knit Discord friend group, for ${year}.

Their stats (null means they didn't play that game):
${JSON.stringify(stats, null, 2)}

Write 2-3 sentences that playfully roast and celebrate them based on the most notable stats. Affectionate, funny, a little savage, like a friend would. Reference specific numbers. No hashtags, no preamble, no quotation marks.`;

	try {
		return await generateText(prompt);
	}
	catch (error) {
		console.error('Wrapped roast failed:', error);
		return null;
	}
}

function buildEmbed(user, name, year, stats, roast) {
	const embed = new EmbedBuilder()
		.setColor(0x1DB954)
		.setTitle(`🎁 Goutcord Wrapped ${year}: ${name}`)
		.setThumbnail(user.displayAvatarURL())
		.setTimestamp();

	if (stats.level !== null) {
		embed.addFields({
			name: '⚡ Yapping',
			value: `Level **${stats.level}** (#${stats.xpRank} in the server)\n**${stats.levelUps}** level-ups this year`,
			inline: true,
		});
	}

	if (stats.wordle) {
		const w = stats.wordle;
		embed.addFields({
			name: '🟩 Wordle',
			value: `**${w.games}** games • ${w.winRate}% wins\nAvg **${w.avg ?? 'N/A'}** • best streak **${w.bestStreak}**` +
				(w.holeInOnes ? `\n🎯 ${w.holeInOnes} hole-in-one${w.holeInOnes !== 1 ? 's' : ''}` : ''),
			inline: true,
		});
	}

	if (stats.maptap) {
		embed.addFields({
			name: '🗺️ MapTap',
			value: `**${stats.maptap.games}** games\nAvg **${stats.maptap.avg}** • best **${stats.maptap.best}**`,
			inline: true,
		});
	}

	const daily = [
		stats.gmcs && `☀️ Wished the crew good morning ${times(stats.gmcs)}`,
		stats.gacs && `🏃 Triggered **${stats.gacs}** Lucas excuse${stats.gacs !== 1 ? 's' : ''}`,
		stats.boots && `🥾 Booted jaf ${times(stats.boots)}`,
		stats.toots && `💨 Logged **${stats.toots}** deth toot${stats.toots !== 1 ? 's' : ''}`,
		stats.betNet && `🎲 ${stats.betNet > 0 ? 'Won' : 'Lost'} **${Math.abs(stats.betNet)} XP** betting on Lucas`,
	].filter(Boolean);
	if (daily.length > 0) embed.addFields({ name: '📆 The Daily Grind', value: daily.join('\n') });

	const fame = [
		stats.quotedCount && `📝 Quoted out of context ${times(stats.quotedCount)}`,
		stats.quotesAdded && `🫵 Saved **${stats.quotesAdded}** quote${stats.quotesAdded !== 1 ? 's' : ''} from others`,
		stats.nominationsReceived && `🏆 **${stats.nominationsReceived}** award nomination${stats.nominationsReceived !== 1 ? 's' : ''}: ` +
			Object.entries(stats.nominationsByAward).map(([type, n]) => `${AWARDS[type]?.emoji ?? '🏅'}×${n}`).join(' '),
		stats.nominationsGiven && `📮 Nominated others ${times(stats.nominationsGiven)}`,
	].filter(Boolean);
	if (fame.length > 0) embed.addFields({ name: '🌟 Fame & Infamy', value: fame.join('\n') });

	if (roast) embed.setDescription(`*${roast}*`);
	if (!embed.data.fields?.length) embed.setDescription(`${name} was a ghost in ${year}. 👻 Nothing to wrap.`);

	return embed;
}

module.exports = {
	cooldown: 30,
	data: new SlashCommandBuilder()
		.setName('wrapped')
		.setDescription('Your Goutcord year in review')
		.addUserOption(option => option
			.setName('user')
			.setDescription('Whose year to wrap (defaults to you)')
			.setRequired(false))
		.addIntegerOption(option => option
			.setName('year')
			.setDescription('Which year (defaults to this year)')
			.setMinValue(2020)
			.setRequired(false)),

	async execute(interaction) {
		const user = interaction.options.getUser('user') || interaction.user;
		const year = interaction.options.getInteger('year') || new Date().getFullYear();
		const name = getNickname(user.id, user.username);

		await interaction.deferReply();

		const stats = await gatherStats(user, year);
		const hasAnything = stats.wordle || stats.maptap || stats.gmcs || stats.quotedCount || stats.nominationsReceived || stats.levelUps;
		const roast = hasAnything ? await writeRoast(name, year, stats) : null;

		await interaction.editReply({ embeds: [buildEmbed(user, name, year, stats, roast)] });
	},
};
