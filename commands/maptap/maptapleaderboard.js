const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { PERIOD_CHOICES, PERIOD_LABELS, getPeriodStart } = require('../../utils/periods');
const { getNickname } = require('../../utils/getNickname');
const { Op, fn, col } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maptapleaderboard')
        .setDescription('Compare MapTap performance across all server members')
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Filter the leaderboard to a specific time period')
                .setRequired(false)
                .addChoices(...PERIOD_CHOICES))
        .addStringOption(option =>
            option.setName('metric')
                .setDescription('Stat to rank players by')
                .setRequired(false)
                .addChoices(
                    { name: 'Average Score (Best)', value: 'avg' },
                    { name: 'Best Single Score', value: 'best' },
                    { name: 'Total Score', value: 'total' },
                    { name: 'Games Played (Most)', value: 'games' },
                )),
    async execute(interaction) {
        const period = interaction.options.getString('period') || 'all';
        const metric = interaction.options.getString('metric') || 'avg';

        const MapTapScore = interaction.client.models.MapTapScore;

        const now = new Date();
        let periodStart = getPeriodStart(period, now);
        const dateFilter = periodStart ? { postedAt: { [Op.gte]: periodStart } } : {};

        try {
            const stats = await MapTapScore.findAll({
                attributes: [
                    'userId',
                    'username',
                    [fn('COUNT', col('id')), 'totalGames'],
                    [fn('AVG', col('finalScore')), 'avgScore'],
                    [fn('MAX', col('finalScore')), 'bestScore'],
                    [fn('MIN', col('finalScore')), 'worstScore'],
                    [fn('SUM', col('finalScore')), 'totalScore'],
                ],
                where: dateFilter,
                group: ['userId', 'username'],
                raw: true,
            });

            if (stats.length === 0) {
                return interaction.reply({
                    content: 'No MapTap scores found for the selected period.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (period === 'all') {
                const earliest = await MapTapScore.findOne({
                    attributes: ['postedAt'],
                    order: [['postedAt', 'ASC']],
                    raw: true,
                });
                if (earliest) {
                    periodStart = new Date(earliest.postedAt);
                }
            }

            const daysInPeriod = Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24)) + 1;
            const minGames = Math.ceil(daysInPeriod * 0.3);

            const leaderboard = stats.map(s => ({
                userId: s.userId,
                username: s.username,
                totalGames: parseInt(s.totalGames, 10),
                avgScore: parseFloat(s.avgScore).toFixed(1),
                bestScore: parseInt(s.bestScore, 10),
                worstScore: parseInt(s.worstScore, 10),
                totalScore: parseInt(s.totalScore, 10),
            })).filter(entry => entry.totalGames >= minGames);

            if (leaderboard.length === 0) {
                return interaction.reply({
                    content: `No players have completed the minimum ${minGames} games (30% of ${daysInPeriod} days) for this period.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (metric === 'avg') {
                leaderboard.sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));
            } else if (metric === 'best') {
                leaderboard.sort((a, b) => b.bestScore - a.bestScore);
            } else if (metric === 'total') {
                leaderboard.sort((a, b) => b.totalScore - a.totalScore);
            } else if (metric === 'games') {
                leaderboard.sort((a, b) => b.totalGames - a.totalGames);
            }

            const top = leaderboard.slice(0, 15);
            const medals = ['🥇', '🥈', '🥉'];

            const leaderboardText = top.map((entry, index) => {
                const rank = index < 3 ? medals[index] : `\`${(index + 1).toString().padStart(2)}\``;
                return `${rank} **${getNickname(entry.userId, entry.username)}** - Avg: ${entry.avgScore} | Best: ${entry.bestScore} | ${entry.totalGames} games`;
            }).join('\n');

            const metricLabels = {
                avg: 'Average Score',
                best: 'Best Single Score',
                total: 'Total Score',
                games: 'Games Played',
            };

            const embed = new EmbedBuilder()
                .setColor(0x1ABC9C)
                .setTitle('🗺️ MapTap Leaderboard')
                .setDescription(`**${PERIOD_LABELS[period]}** • Sorted by: ${metricLabels[metric]}\n*Minimum ${minGames} games required (30% of ${daysInPeriod} days)*`)
                .addFields({ name: 'Rankings', value: leaderboardText || 'No data available' })
                .setFooter({ text: `${leaderboard.length} qualified players • ${stats.length} total players` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching MapTap leaderboard:', error);
            await interaction.reply({
                content: 'An error occurred while fetching the leaderboard.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
