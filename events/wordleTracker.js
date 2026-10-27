const { Events } = require('discord.js');
const { WordleScore } = require('../models');
const { channels } = require('../config/settings');
const { parseWordleShare } = require('../utils/wordle');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.channel.id !== channels.wordle) return;
        if (message.author.bot) return;

        const parsed = parseWordleShare(message.content);
        if (!parsed) return;

        try {
            // Unique (userId, wordleNumber) index means a repost of the same puzzle is a no-op
            const [, created] = await WordleScore.findOrCreate({
                where: {
                    userId: message.author.id,
                    wordleNumber: parsed.wordleNumber,
                },
                defaults: {
                    username: message.author.username,
                    score: parsed.score,
                    hardMode: parsed.hardMode,
                    messageId: message.id,
                    postedAt: message.createdAt,
                },
            });

            if (created) await message.react('📊');
        }
        catch (error) {
            console.error('Error storing Wordle score:', error);
        }
    },
};
