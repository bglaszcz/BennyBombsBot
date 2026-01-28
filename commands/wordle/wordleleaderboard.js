const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Op, fn, col, literal } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordleleaderboard')
        .setDescription('View Wordle leaderboard')
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Time period for leaderboard')
                .setRequired(false)
                .addChoices(
                    { name: 'All Time', value: 'all' },
                    { name: 'This Year', value: 'year' },
                    { name: 'This Month', value: 'month' },
                    { name: 'This Week', value: 'week' },
                ))
        .addStringOption(option =>
            option.setName('sort')
                .setDescription('How to rank players')
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
        const sequelize = interaction.client.sequelize;

        // Build date filter based on period
        const now = new Date();
        let dateFilter = {};

        if (period === 'year') {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            dateFilter = { postedAt: { [Op.gte]: startOfYear } };
        } else if (period === 'month') {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            dateFilter = { postedAt: { [Op.gte]: startOfMonth } };
        } else if (period === 'week') {
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() - now.getDay());
            startOfWeek.setHours(0, 0, 0, 0);
            dateFilter = { postedAt: { [Op.gte]: startOfWeek } };
        }

        try {
            // Get aggregated stats for all users
            const stats = await WordleScore.findAll({
                attributes: [
                    'userId',
                    'username',
                    [fn('COUNT', col('id')), 'totalGames'],
                    [fn('SUM', literal('CASE WHEN score <= 6 THEN 1 ELSE 0 END')), 'wins'],
                    [fn('AVG', literal('CASE WHEN score <= 6 THEN score ELSE NULL END')), 'avgScore'],
                ],
                where: dateFilter,
                group: ['userId', 'username'],
                raw: true,
            });

            if (stats.length === 0) {
                return interaction.reply({
                    content: 'No Wordle scores found for the selected period.',
                    ephemeral: true,
                });
            }

            // Calculate win rate and format data
            const leaderboard = stats.map(s => ({
                userId: s.userId,
                username: s.username,
                totalGames: parseInt(s.totalGames, 10),
                wins: parseInt(s.wins, 10),
                avgScore: s.avgScore ? parseFloat(s.avgScore).toFixed(2) : null,
                winRate: s.totalGames > 0 ? ((s.wins / s.totalGames) * 100).toFixed(1) : 0,
            }));

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
                return `${rank} **${entry.username}** - Avg: ${avgDisplay} | ${entry.wins}/${entry.totalGames} wins (${entry.winRate}%)`;
            }).join('\n');

            // Period and sort labels
            const periodLabels = {
                all: 'All Time',
                year: 'This Year',
                month: 'This Month',
                week: 'This Week',
            };
            const sortLabels = {
                avg: 'Average Score',
                games: 'Games Played',
                winrate: 'Win Rate',
                wins: 'Total Wins',
            };

            const embed = new EmbedBuilder()
                .setColor(0x538D4E) // Wordle green
                .setTitle('🏆 Wordle Leaderboard')
                .setDescription(`**${periodLabels[period]}** • Sorted by: ${sortLabels[sortBy]}`)
                .addFields({ name: 'Rankings', value: leaderboardText || 'No data available' })
                .setFooter({ text: `${stats.length} players total` })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching Wordle leaderboard:', error);
            await interaction.reply({
                content: 'An error occurred while fetching the leaderboard.',
                ephemeral: true,
            });
        }
    },
};
