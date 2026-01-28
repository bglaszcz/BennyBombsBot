const { Events } = require('discord.js');

const WORDLE_CHANNEL_ID = '930279618437586974';

// Regex to parse Wordle scores
// Matches: "Wordle 1,682 4/6*" or "Wordle 1682 X/6"
const WORDLE_REGEX = /Wordle\s+([\d,]+)\s+([X1-6])\/6(\*)?/i;

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Only process messages in the Wordle channel
        if (message.channel.id !== WORDLE_CHANNEL_ID) return;

        // Ignore bot messages
        if (message.author.bot) return;

        // Try to parse the Wordle score
        const match = message.content.match(WORDLE_REGEX);
        if (!match) return;

        const wordleNumber = parseInt(match[1].replace(/,/g, ''), 10);
        const scoreStr = match[2];
        const hardMode = match[3] === '*';

        // Convert score: X means failed (store as 7), otherwise 1-6
        const score = scoreStr.toUpperCase() === 'X' ? 7 : parseInt(scoreStr, 10);

        try {
            const WordleScore = message.client.models.WordleScore;

            // Check if user already has a score for this Wordle
            const existing = await WordleScore.findOne({
                where: {
                    userId: message.author.id,
                    wordleNumber: wordleNumber,
                },
            });

            if (existing) {
                // User already submitted this Wordle - could react or ignore
                return;
            }

            // Store the new score
            await WordleScore.create({
                userId: message.author.id,
                username: message.author.username,
                wordleNumber: wordleNumber,
                score: score,
                hardMode: hardMode,
                messageId: message.id,
                postedAt: message.createdAt,
            });

            // Optional: React to confirm the score was recorded
            await message.react('📊');

        } catch (error) {
            console.error('Error storing Wordle score:', error);
        }
    },
};
