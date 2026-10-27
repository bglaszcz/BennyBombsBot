const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { MapTapScore } = require('../../models');
const { compareHeadToHead, verdict } = require('../../utils/headToHead');
const { getNickname } = require('../../utils/getNickname');

const formatDate = key => new Date(`${key}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maptapvs')
        .setDescription('Head-to-head MapTap record on the puzzles you both played')
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
            MapTapScore.findAll({ where: { userId: playerA.id }, attributes: ['puzzleDate', 'finalScore'], raw: true }),
            MapTapScore.findAll({ where: { userId: playerB.id }, attributes: ['puzzleDate', 'finalScore'], raw: true }),
        ]);

        const record = compareHeadToHead(scoresA, scoresB, {
            keyOf: row => row.puzzleDate,
            valueOf: row => row.finalScore,
            lowerIsBetter: false,
        });

        const nameA = getNickname(playerA.id, playerA.username);
        const nameB = getNickname(playerB.id, playerB.username);

        if (record.meetings.length === 0) {
            return interaction.reply(`**${nameA}** and **${nameB}** have never played the same MapTap. 🤝`);
        }

        const avg = side => Math.round(record.meetings.reduce((sum, m) => sum + m[side], 0) / record.meetings.length);
        const blowout = record.meetings.reduce((max, m) => (Math.abs(m.a - m.b) > Math.abs(max.a - max.b) ? m : max));
        const recent = record.meetings.slice(0, 5)
            .map(m => `${formatDate(m.key)}: ${m.a} vs ${m.b}`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x1ABC9C)
            .setTitle(`🗺️ ${nameA} vs ${nameB}`)
            .setDescription(verdict(nameA, nameB, record))
            .addFields(
                { name: 'Record', value: `**${record.wins}-${record.losses}-${record.ties}** (W-L-T)`, inline: true },
                { name: 'Shared puzzles', value: `${record.meetings.length}`, inline: true },
                { name: 'Avg on shared', value: `${avg('a')} vs ${avg('b')}`, inline: true },
                { name: 'Biggest blowout', value: `${formatDate(blowout.key)}: ${blowout.a} vs ${blowout.b}`, inline: true },
                { name: 'Recent meetings', value: recent },
            );

        return interaction.reply({ embeds: [embed] });
    },
};
