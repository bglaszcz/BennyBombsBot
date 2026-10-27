const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { DethToot, DethTootLog, sequelize } = require('../../models');
const { formatDuration } = require('../../utils/formatDuration');
const { getNickname, getNicknameByUsername } = require('../../utils/getNickname');

const MEDALS = ['🥇', '🥈', '🥉'];
const rank = i => MEDALS[i] || `\`${i + 1}.\``;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('dethtoots')
		.setDescription('Deth toot leaderboard: longest droughts and most frequent offenders'),

	async execute(interaction) {
		const [latest, offenders] = await Promise.all([
			// Oldest "last toot" first = longest current drought
			DethToot.findAll({ order: [['lastTootDate', 'ASC']], limit: 10, raw: true }),
			DethTootLog.findAll({
				attributes: ['userId', 'username', [sequelize.fn('COUNT', sequelize.col('id')), 'toots']],
				group: ['userId', 'username'],
				order: [[sequelize.literal('"toots"'), 'DESC']],
				limit: 10,
				raw: true,
			}),
		]);

		if (latest.length === 0) {
			return interaction.reply('No deth toots on record. Suspiciously fresh in here. 🌸');
		}

		const now = Date.now();
		const droughts = latest
			.map((row, i) => `${rank(i)} **${getNicknameByUsername(row.username)}** — ${formatDuration(now - new Date(row.lastTootDate), 2)} clean`)
			.join('\n');

		const embed = new EmbedBuilder()
			.setColor(0x7B3F00)
			.setTitle('💨 Deth Toot Leaderboard')
			.addFields({ name: '🧘 Longest current drought', value: droughts });

		if (offenders.length > 0) {
			const frequent = offenders
				.map((row, i) => `${rank(i)} **${getNickname(row.userId, row.username)}** — ${row.toots} toot${Number(row.toots) !== 1 ? 's' : ''}`)
				.join('\n');
			embed.addFields({ name: '☣️ Most frequent offenders', value: frequent });
		}

		const firstLog = await DethTootLog.min('tootedAt');
		if (firstLog) {
			embed.setFooter({ text: 'Toot counts tracked since' }).setTimestamp(new Date(firstLog));
		}

		return interaction.reply({ embeds: [embed] });
	},
};
