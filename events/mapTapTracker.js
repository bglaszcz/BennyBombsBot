const { Events } = require('discord.js');
const { MapTapScore, User } = require('../models');
const { channels, economy } = require('../config/settings');
const { settleScoreMarket } = require('../services/bets');
const { parseMapTapShare } = require('../utils/parseMapTap');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.channel.id !== channels.maptap) return;
        if (message.author.bot) return;

        const parsed = parseMapTapShare(message.content, message.createdAt);
        if (!parsed) return;

        try {
            // Unique (userId, puzzleDate) index means a repost of the same puzzle is a no-op
            const [, created] = await MapTapScore.findOrCreate({
                where: {
                    userId: message.author.id,
                    puzzleDate: parsed.puzzleDate,
                },
                defaults: {
                    username: message.author.username,
                    roundScores: parsed.roundScores,
                    finalScore: parsed.finalScore,
                    messageId: message.id,
                    postedAt: message.createdAt,
                },
            });

            if (!created) return;
            await message.react('🗺️');
            await User.increment('coins', { by: economy.scorePostBonus, where: { userId: message.author.id } });
            await settleScoreMarket(message.client, 'maptap', message.author.id, parsed.puzzleDate, parsed.finalScore);
        }
        catch (error) {
            console.error('Error storing MapTap score:', error);
        }
    },
};
