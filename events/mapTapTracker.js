const { Events } = require('discord.js');
const { MapTapScore } = require('../models');
const { channels } = require('../config/settings');
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

            if (created) await message.react('🗺️');
        }
        catch (error) {
            console.error('Error storing MapTap score:', error);
        }
    },
};
