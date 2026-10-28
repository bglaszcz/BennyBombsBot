const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { PERIOD_CHOICES, PERIOD_LABELS, getPeriodStart } = require('../../utils/periods');
const { getNickname } = require('../../utils/getNickname');
const { Op, fn, col, literal } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordleleaderboard')
        .setDescription('Compare Wordle performance across all server members')
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Filter the leaderboard to a specific time period')
                .setRequired(false)
                .addChoices(...PERIOD_CHOICES))
        .addStringOption(option =>
            option.setName('sort')
                .setDescription('Stat to rank players by')
                .setRequired(false)
                .addChoices(
                    { name: 'Average Score (Best)', value: 'avg' },
                    { name: 'Games Played (Most)', value: 'games' },
                    { name: 'Win Rate (Highest)', value: 'winrate' },
                    { name: 'Total Wins (Most)', value: 'wins' },
                )),
    async execute(interaction) {
        const period = interaction.options.getString('period') || 'all';
        const sortBy = interaction.options.getString('sort') || 'avg';

        const WordleScore = interaction.client.models.WordleScore;

        const now = new Date();
        let periodStart = getPeriodStart(period, now);
        const dateFilter = periodStart ? { postedAt: { [Op.gte]: periodStart } } : {};

        try {
            // Get aggregated stats for all users
            const stats = await WordleScore.findAll({
                attributes: [
                    'userId',
                    // One row per user even if they renamed; any of their usernames will do
                    [fn('MAX', col('username')), 'username'],
                    [fn('COUNT', col('id')), 'totalGames'],
                    [fn('SUM', literal('CASE WHEN score <= 6 THEN 1 ELSE 0 END')), 'wins'],
                    [fn('AVG', literal('CASE WHEN score <= 6 THEN score ELSE 7 END')), 'avgScore'],
                ],
                where: dateFilter,
                group: ['userId'],
                raw: true,
            });

            if (stats.length === 0) {
                return interaction.reply({
                    content: 'No Wordle scores found for the selected period.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            // For "all time", get the earliest score date as the period start
            if (period === 'all') {
                const earliest = await WordleScore.findOne({
                    attributes: ['postedAt'],
                    order: [['postedAt', 'ASC']],
                    raw: true,
                });
                if (earliest) {
                    periodStart = new Date(earliest.postedAt);
                }
            }

            // Calculate minimum games required (30% of days in period)
            const daysInPeriod = Math.ceil((now - periodStart) / (1000 * 60 * 60 * 24)) + 1;
            const minGames = Math.ceil(daysInPeriod * 0.3);

            // Calculate win rate and format data, filter by minimum games
            const leaderboard = stats.map(s => ({
                userId: s.userId,
                username: s.username,
                totalGames: parseInt(s.totalGames, 10),
                wins: parseInt(s.wins, 10),
                avgScore: s.avgScore ? parseFloat(s.avgScore).toFixed(2) : null,
                winRate: s.totalGames > 0 ? ((s.wins / s.totalGames) * 100).toFixed(1) : 0,
            })).filter(entry => entry.totalGames >= minGames);

            if (leaderboard.length === 0) {
                return interaction.reply({
                    content: `No players have completed the minimum ${minGames} games (30% of ${daysInPeriod} days) for this period.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            // Sort based on selected criteria
            if (sortBy === 'avg') {
                // Lower average is better, null/no wins go to end
                leaderboard.sort((a, b) => {
                    if (a.avgScore === null) return 1;
                    if (b.avgScore === null) return -1;
                    return parseFloat(a.avgScore) - parseFloat(b.avgScore);
                });
            } else if (sortBy === 'games') {
                leaderboard.sort((a, b) => b.totalGames - a.totalGames);
            } else if (sortBy === 'winrate') {
                leaderboard.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
            } else if (sortBy === 'wins') {
                leaderboard.sort((a, b) => b.wins - a.wins);
            }

            // Take top 15
            const top = leaderboard.slice(0, 15);

            // Medal emojis for top 3
            const medals = ['🥇', '🥈', '🥉'];

            // Build leaderboard text
            const leaderboardText = top.map((entry, index) => {
                const rank = index < 3 ? medals[index] : `\`${(index + 1).toString().padStart(2)}\``;
                const avgDisplay = entry.avgScore || 'N/A';
                return `${rank} **${getNickname(entry.userId, entry.username)}** - Avg: ${avgDisplay} | ${entry.wins}/${entry.totalGames} wins (${entry.winRate}%)`;
            }).join('\n');

            // Period and sort labels
            const sortLabels = {
                avg: 'Average Score',
                games: 'Games Played',
                winrate: 'Win Rate',
                wins: 'Total Wins',
            };

            const embed = new EmbedBuilder()
                .setColor(0x538D4E) // Wordle green
                .setTitle('🏆 Wordle Leaderboard')
                .setDescription(`**${PERIOD_LABELS[period]}** • Sorted by: ${sortLabels[sortBy]}\n*Minimum ${minGames} games required (30% of ${daysInPeriod} days)*`)
                .addFields({ name: 'Rankings', value: leaderboardText || 'No data available' })
                .setFooter({ text: `${leaderboard.length} qualified players • ${stats.length} total players` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching Wordle leaderboard:', error);
            await interaction.reply({
                content: 'An error occurred while fetching the leaderboard.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
