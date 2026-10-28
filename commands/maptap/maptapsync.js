const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Op } = require('sequelize');
const { MapTapScore } = require('../../models');
const { channels } = require('../../config/settings');
const { parseMapTapShare } = require('../../utils/parseMapTap');
const { syncChannelScores } = require('../../utils/channelSync');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('maptapsync')
        .setDescription('Import historical MapTap scores from the channel (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('Maximum messages to scan (default: 5000, max: 50000)')
                .setRequired(false)
                .setMinValue(100)
                .setMaxValue(50000)),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const channel = await interaction.client.channels.fetch(channels.maptap);

            await syncChannelScores({
                interaction,
                channel,
                limit: interaction.options.getInteger('limit') || 5000,
                label: 'MapTap',
                reaction: '🗺️',
                parse: message => {
                    const parsed = parseMapTapShare(message.content, message.createdAt);
                    if (!parsed) return null;
                    return {
                        ...parsed,
                        userId: message.author.id,
                        username: message.author.username,
                        messageId: message.id,
                        postedAt: message.createdAt,
                    };
                },
                keyOf: row => `${row.userId}:${row.puzzleDate}`,
                findExistingKeys: async rows => {
                    const dates = rows.map(r => r.puzzleDate).sort();
                    const existing = await MapTapScore.findAll({
                        where: { puzzleDate: { [Op.between]: [dates[0], dates[dates.length - 1]] } },
                        attributes: ['userId', 'puzzleDate'],
                        raw: true,
                    });
                    return new Set(existing.map(s => `${s.userId}:${s.puzzleDate}`));
                },
                insert: batch => MapTapScore.bulkCreate(batch, { ignoreDuplicates: true }),
            });
        }
        catch (error) {
            console.error('Error syncing MapTap scores:', error);
            await interaction.editReply(`An error occurred while syncing MapTap scores: ${error.message}`);
        }
    },
};
