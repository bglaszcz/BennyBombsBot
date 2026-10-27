const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { WordleScore } = require('../../models');
const { compareHeadToHead, verdict } = require('../../utils/headToHead');
const { getNickname } = require('../../utils/getNickname');

const formatScore = score => (score === 7 ? 'X' : score);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordlevs')
        .setDescription('Head-to-head Wordle record on the puzzles you both played')
        .addUserOption(option => option
            .setName('opponent')
            .setDescription('Who to compare against')
            .setRequired(true))
        .addUserOption(option => option
            .setName('player')
            .setDescription('Compare someone else instead of you')
            .setRequired(false)),

    async execute(interaction) {
        const playerA = interaction.options.getUser('player') || interaction.user;
        const playerB = interaction.options.getUser('opponent');
        if (playerA.id === playerB.id) {
            return interaction.reply({ content: 'Playing yourself? Bold. Pick an actual opponent. 🪞', flags: MessageFlags.Ephemeral });
        }

        const [scoresA, scoresB] = await Promise.all([
            WordleScore.findAll({ where: { userId: playerA.id }, attributes: ['wordleNumber', 'score'], raw: true }),
            WordleScore.findAll({ where: { userId: playerB.id }, attributes: ['wordleNumber', 'score'], raw: true }),
        ]);

        // X is stored as 7, so lower-is-better already treats a fail as the worst score
        const record = compareHeadToHead(scoresA, scoresB, {
            keyOf: row => row.wordleNumber,
            valueOf: row => row.score,
            lowerIsBetter: true,
        });

        const nameA = getNickname(playerA.id, playerA.username);
        const nameB = getNickname(playerB.id, playerB.username);

        if (record.meetings.length === 0) {
            return interaction.reply(`**${nameA}** and **${nameB}** have never played the same Wordle. 🤝`);
        }

        const avg = side => (record.meetings.reduce((sum, m) => sum + m[side], 0) / record.meetings.length).toFixed(2);
        const recent = record.meetings.slice(0, 5)
            .map(m => `#${m.key}: ${formatScore(m.a)} vs ${formatScore(m.b)}`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x538D4E)
            .setTitle(`🟩 ${nameA} vs ${nameB}`)
            .setDescription(verdict(nameA, nameB, record))
            .addFields(
                { name: 'Record', value: `**${record.wins}-${record.losses}-${record.ties}** (W-L-T)`, inline: true },
                { name: 'Shared puzzles', value: `${record.meetings.length}`, inline: true },
                { name: 'Avg on shared', value: `${avg('a')} vs ${avg('b')}`, inline: true },
                { name: 'Recent meetings', value: recent },
            );

        return interaction.reply({ embeds: [embed] });
    },
};
