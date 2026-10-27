const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { WordleScore } = require('../../models');
const { addPeriodOption, getPeriodFilter, PERIOD_LABELS } = require('../../utils/periods');
const { calculateStreaks } = require('../../utils/wordle');
const { getNickname } = require('../../utils/getNickname');

module.exports = {
    data: addPeriodOption(
        new SlashCommandBuilder()
            .setName('wordlestats')
            .setDescription('View your Wordle stats: win rate, streaks, score distribution, and recent games')
            .addUserOption(option =>
                option.setName('user')
                    .setDescription('User to view stats for (defaults to you)')
                    .setRequired(false)),
        'Filter stats to a specific time period',
    ),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const period = interaction.options.getString('period') || 'all';
        const displayName = getNickname(targetUser.id, targetUser.username);

        const scores = await WordleScore.findAll({
            where: {
                userId: targetUser.id,
                ...getPeriodFilter(period),
            },
            order: [['wordleNumber', 'DESC']],
        });

        if (scores.length === 0) {
            return interaction.reply({
                content: `No Wordle scores found for ${displayName} in the selected period.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const totalGames = scores.length;
        const winningScores = scores.filter(s => s.score <= 6);
        const winRate = ((winningScores.length / totalGames) * 100).toFixed(1);

        // Average score (excluding failures)
        const avgScore = winningScores.length > 0
            ? (winningScores.reduce((sum, s) => sum + s.score, 0) / winningScores.length).toFixed(2)
            : 'N/A';

        // Score distribution: indexes 0-5 for scores 1-6, index 6 for X
        const distribution = [0, 0, 0, 0, 0, 0, 0];
        scores.forEach(s => distribution[s.score - 1]++);

        const { currentStreak, bestStreak } = calculateStreaks(scores);
        const hardModeGames = scores.filter(s => s.hardMode).length;

        const maxDist = Math.max(...distribution);
        const distChart = distribution.map((count, i) => {
            const label = i === 6 ? 'X' : (i + 1).toString();
            const barLength = maxDist > 0 ? Math.round((count / maxDist) * 10) : 0;
            const bar = '🟩'.repeat(barLength) + '⬜'.repeat(10 - barLength);
            return `\`${label}\` ${bar} ${count}`;
        }).join('\n');

        const recentText = scores.slice(0, 5).map(g => {
            const scoreDisplay = g.score === 7 ? 'X' : g.score;
            return `#${g.wordleNumber}: ${scoreDisplay}/6${g.hardMode ? '*' : ''}`;
        }).join(' | ');

        const embed = new EmbedBuilder()
            .setColor(0x538D4E) // Wordle green
            .setTitle(`📊 Wordle Stats: ${displayName}`)
            .setDescription(`**${PERIOD_LABELS[period]}**`)
            .addFields(
                { name: '🎮 Games Played', value: totalGames.toString(), inline: true },
                { name: '✅ Win Rate', value: `${winRate}%`, inline: true },
                { name: '📈 Avg Score', value: avgScore.toString(), inline: true },
                { name: '🔥 Current Streak', value: currentStreak.toString(), inline: true },
                { name: '⭐ Best Streak', value: bestStreak.toString(), inline: true },
                { name: '🎯 Hard Mode', value: hardModeGames.toString(), inline: true },
                { name: '\n📊 Score Distribution', value: distChart, inline: false },
                { name: '🕐 Recent Games', value: recentText, inline: false },
            )
            .setTimestamp();

        const response = await interaction.reply({ embeds: [embed], withResponse: true });
        setTimeout(() => response.resource.message.delete().catch(() => {}), 5 * 60 * 1000);
    },
};
