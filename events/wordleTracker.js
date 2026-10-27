const { Events } = require('discord.js');
const { WordleScore, User } = require('../models');
const { channels, economy } = require('../config/settings');
const { settleScoreMarket } = require('../services/bets');
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

            if (!created) return;
            await message.react('📊');
            await User.increment('coins', { by: economy.scorePostBonus, where: { userId: message.author.id } });
            await settleScoreMarket(message.client, 'wordle', message.author.id, String(parsed.wordleNumber), parsed.score);
        }
        catch (error) {
            console.error('Error storing Wordle score:', error);
        }
    },
};
