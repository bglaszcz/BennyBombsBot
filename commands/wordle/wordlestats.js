const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Op } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordlestats')
        .setDescription('View Wordle statistics')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view stats for (defaults to yourself)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Time period for stats')
                .setRequired(false)
                .addChoices(
                    { name: 'All Time', value: 'all' },
                    { name: 'This Year', value: 'year' },
                    { name: 'This Month', value: 'month' },
                    { name: 'This Week', value: 'week' },
                )),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const period = interaction.options.getString('period') || 'all';

        const WordleScore = interaction.client.models.WordleScore;

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
            // Get all scores for the user in the period
            const scores = await WordleScore.findAll({
                where: {
                    userId: targetUser.id,
                    ...dateFilter,
                },
                order: [['wordleNumber', 'DESC']],
            });

            if (scores.length === 0) {
                return interaction.reply({
                    content: `No Wordle scores found for ${targetUser.username} in the selected period.`,
                    ephemeral: true,
                });
            }

            // Calculate statistics
            const totalGames = scores.length;
            const wins = scores.filter(s => s.score <= 6).length;
            const losses = scores.filter(s => s.score === 7).length;
            const winRate = ((wins / totalGames) * 100).toFixed(1);

            // Average score (excluding failures)
            const winningScores = scores.filter(s => s.score <= 6);
            const avgScore = winningScores.length > 0
                ? (winningScores.reduce((sum, s) => sum + s.score, 0) / winningScores.length).toFixed(2)
                : 'N/A';

            // Score distribution
            const distribution = [0, 0, 0, 0, 0, 0, 0]; // indexes 0-5 for scores 1-6, index 6 for X
            scores.forEach(s => {
                if (s.score === 7) {
                    distribution[6]++;
                } else {
                    distribution[s.score - 1]++;
                }
            });

            // Current streak and best streak
            // Streaks break on losses AND missed days (gaps in Wordle numbers)
            const sortedScores = [...scores].sort((a, b) => b.wordleNumber - a.wordleNumber);
            let currentStreak = 0;
            let bestStreak = 0;
            let tempStreak = 0;

            for (let i = 0; i < sortedScores.length; i++) {
                const score = sortedScores[i];
                const prevNumber = i > 0 ? sortedScores[i - 1].wordleNumber : null;

                // Check for gap in Wordle numbers (missed day)
                const hasGap = prevNumber !== null && (prevNumber - score.wordleNumber) > 1;

                if (hasGap) {
                    // Missed a day - streak breaks
                    if (currentStreak === 0) currentStreak = tempStreak;
                    tempStreak = 0;
                }

                if (score.score <= 6) {
                    tempStreak++;
                    if (tempStreak > bestStreak) bestStreak = tempStreak;
                } else {
                    if (currentStreak === 0) currentStreak = tempStreak;
                    tempStreak = 0;
                }
            }
            if (currentStreak === 0) currentStreak = tempStreak;
            if (tempStreak > bestStreak) bestStreak = tempStreak;

            // Hard mode stats
            const hardModeGames = scores.filter(s => s.hardMode).length;

            // Best and worst scores
            const bestScore = Math.min(...winningScores.map(s => s.score));
            const worstWin = Math.max(...winningScores.map(s => s.score));

            // Recent games (last 5)
            const recentGames = sortedScores.slice(0, 5);

            // Build distribution bar chart
            const maxDist = Math.max(...distribution);
            const distChart = distribution.map((count, i) => {
                const label = i === 6 ? 'X' : (i + 1).toString();
                const barLength = maxDist > 0 ? Math.round((count / maxDist) * 10) : 0;
                const bar = '🟩'.repeat(barLength) + '⬜'.repeat(10 - barLength);
                return `\`${label}\` ${bar} ${count}`;
            }).join('\n');

            // Period label
            const periodLabels = {
                all: 'All Time',
                year: 'This Year',
                month: 'This Month',
                week: 'This Week',
            };

            const embed = new EmbedBuilder()
                .setColor(0x538D4E) // Wordle green
                .setTitle(`📊 Wordle Stats: ${targetUser.username}`)
                .setDescription(`**${periodLabels[period]}**`)
                .addFields(
                    { name: '🎮 Games Played', value: totalGames.toString(), inline: true },
                    { name: '✅ Win Rate', value: `${winRate}%`, inline: true },
                    { name: '📈 Avg Score', value: avgScore.toString(), inline: true },
                    { name: '🔥 Current Streak', value: currentStreak.toString(), inline: true },
                    { name: '⭐ Best Streak', value: bestStreak.toString(), inline: true },
                    { name: '🎯 Hard Mode', value: hardModeGames.toString(), inline: true },
                    { name: '\n📊 Score Distribution', value: distChart, inline: false },
                )
                .setTimestamp();

            if (recentGames.length > 0) {
                const recentText = recentGames.map(g => {
                    const scoreDisplay = g.score === 7 ? 'X' : g.score;
                    const hardMark = g.hardMode ? '*' : '';
                    return `#${g.wordleNumber}: ${scoreDisplay}/6${hardMark}`;
                }).join(' | ');
                embed.addFields({ name: '🕐 Recent Games', value: recentText, inline: false });
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Error fetching Wordle stats:', error);
            await interaction.reply({
                content: 'An error occurred while fetching Wordle stats.',
                ephemeral: true,
            });
        }
    },
};
