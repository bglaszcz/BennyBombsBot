const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { PERIOD_CHOICES, PERIOD_LABELS, getPeriodFilter } = require('../../utils/periods');
const { getNickname } = require('../../utils/getNickname');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maptapstats')
        .setDescription('View your MapTap stats: average, best/worst score, and per-round breakdown')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('User to view stats for (defaults to you)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Filter stats to a specific time period')
                .setRequired(false)
                .addChoices(...PERIOD_CHOICES)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const period = interaction.options.getString('period') || 'all';

        const MapTapScore = interaction.client.models.MapTapScore;

        const dateFilter = getPeriodFilter(period);
        const displayName = getNickname(targetUser.id, targetUser.username);

        try {
            const scores = await MapTapScore.findAll({
                where: {
                    userId: targetUser.id,
                    ...dateFilter,
                },
                order: [['puzzleDate', 'DESC']],
            });

            if (scores.length === 0) {
                return interaction.reply({
                    content: `No MapTap scores found for ${displayName} in the selected period.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const totalGames = scores.length;
            const finalScores = scores.map(s => s.finalScore);
            const avgScore = (finalScores.reduce((sum, s) => sum + s, 0) / totalGames).toFixed(1);
            const bestScore = Math.max(...finalScores);
            const worstScore = Math.min(...finalScores);

            // Per-round averages (rounds are positional: round 1, 2, 3...)
            const maxRounds = Math.max(...scores.map(s => (s.roundScores || []).length));
            const roundAverages = [];
            for (let i = 0; i < maxRounds; i++) {
                const values = scores.map(s => s.roundScores?.[i]).filter(v => typeof v === 'number');
                if (values.length > 0) {
                    roundAverages.push((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1));
                } else {
                    roundAverages.push('N/A');
                }
            }
            const roundText = roundAverages.map((avg, i) => `R${i + 1}: \`${avg}\``).join('  ');

            const recentGames = scores.slice(0, 5);
            const recentText = recentGames.map(g => {
                const dateLabel = new Date(g.puzzleDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return `${dateLabel}: **${g.finalScore}**`;
            }).join(' | ');

            // Score distribution by 100-point band (e.g. 400-499, 500-599, ...)
            const bandCounts = new Map();
            for (const score of finalScores) {
                const band = Math.floor(score / 100) * 100;
                bandCounts.set(band, (bandCounts.get(band) || 0) + 1);
            }
            const minBand = Math.floor(worstScore / 100) * 100;
            const maxBand = Math.floor(bestScore / 100) * 100;
            const maxBandCount = Math.max(...bandCounts.values());
            const barWidth = 10;
            const bandLines = [];
            for (let band = minBand; band <= maxBand; band += 100) {
                const count = bandCounts.get(band) || 0;
                const filled = maxBandCount > 0 ? Math.round((count / maxBandCount) * barWidth) : 0;
                const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
                bandLines.push(`\`${band}s\` ${bar} ${count}`);
            }
            const bandText = bandLines.join('\n');


            const embed = new EmbedBuilder()
                .setColor(0x1ABC9C)
                .setTitle(`🗺️ MapTap Stats: ${displayName}`)
                .setDescription(`**${PERIOD_LABELS[period]}**`)
                .addFields(
                    { name: '🎮 Games Played', value: totalGames.toString(), inline: true },
                    { name: '📈 Avg Score', value: avgScore.toString(), inline: true },
                    { name: '🏆 Best Score', value: bestScore.toString(), inline: true },
                    { name: '💀 Worst Score', value: worstScore.toString(), inline: true },
                    { name: '\n📊 Avg Score Per Round', value: roundText, inline: false },
                    { name: '📶 Score Distribution', value: bandText, inline: false },
                    { name: '🕐 Recent Games', value: recentText, inline: false },
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });

        } catch (error) {
            console.error('Error fetching MapTap stats:', error);
            await interaction.reply({
                content: 'An error occurred while fetching MapTap stats.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
