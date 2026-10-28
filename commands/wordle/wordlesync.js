const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Op } = require('sequelize');
const { WordleScore } = require('../../models');
const { channels } = require('../../config/settings');
const { parseWordleShare } = require('../../utils/wordle');
const { syncChannelScores } = require('../../utils/channelSync');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordlesync')
        .setDescription('Import historical Wordle scores from the channel (Admin only)')
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
            const channel = await interaction.client.channels.fetch(channels.wordle);

            await syncChannelScores({
                interaction,
                channel,
                limit: interaction.options.getInteger('limit') || 5000,
                label: 'Wordle',
                reaction: '📊',
                parse: message => {
                    const parsed = parseWordleShare(message.content);
                    if (!parsed) return null;
                    return {
                        ...parsed,
                        userId: message.author.id,
                        username: message.author.username,
                        messageId: message.id,
                        postedAt: message.createdAt,
                    };
                },
                keyOf: row => `${row.userId}:${row.wordleNumber}`,
                findExistingKeys: async rows => {
                    const numbers = rows.map(r => r.wordleNumber);
                    const existing = await WordleScore.findAll({
                        where: { wordleNumber: { [Op.between]: [Math.min(...numbers), Math.max(...numbers)] } },
                        attributes: ['userId', 'wordleNumber'],
                        raw: true,
                    });
                    return new Set(existing.map(s => `${s.userId}:${s.wordleNumber}`));
                },
                insert: batch => WordleScore.bulkCreate(batch, { ignoreDuplicates: true }),
            });
        }
        catch (error) {
            console.error('Error syncing Wordle scores:', error);
            await interaction.editReply(`An error occurred while syncing Wordle scores: ${error.message}`);
        }
    },
};
