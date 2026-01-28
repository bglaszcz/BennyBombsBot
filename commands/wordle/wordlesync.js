const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const WORDLE_CHANNEL_ID = '930279618437586974';
const WORDLE_REGEX = /Wordle\s+([\d,]+)\s+([X1-6])\/6(\*)?/i;

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

        const limit = interaction.options.getInteger('limit') || 5000;
        const WordleScore = interaction.client.models.WordleScore;

        try {
            // Get the Wordle channel
            const channel = await interaction.client.channels.fetch(WORDLE_CHANNEL_ID);
            if (!channel) {
                return interaction.editReply('Could not find the Wordle channel.');
            }

            await interaction.editReply(`🔄 Starting sync... Scanning up to ${limit} messages.`);

            // First, collect all messages
            const allScores = [];
            let processed = 0;
            let lastId = null;
            let messagesRemaining = limit;

            // Fetch all messages first (fast)
            while (messagesRemaining > 0) {
                const fetchLimit = Math.min(100, messagesRemaining);
                const options = { limit: fetchLimit };
                if (lastId) options.before = lastId;

                const messages = await channel.messages.fetch(options);
                if (messages.size === 0) break;

                for (const [, message] of messages) {
                    processed++;
                    lastId = message.id;

                    if (message.author.bot) continue;

                    const match = message.content.match(WORDLE_REGEX);
                    if (!match) continue;

                    const wordleNumber = parseInt(match[1].replace(/,/g, ''), 10);
                    const scoreStr = match[2];
                    const hardMode = match[3] === '*';
                    const score = scoreStr.toUpperCase() === 'X' ? 7 : parseInt(scoreStr, 10);

                    allScores.push({
                        userId: message.author.id,
                        username: message.author.username,
                        wordleNumber: wordleNumber,
                        score: score,
                        hardMode: hardMode,
                        messageId: message.id,
                        postedAt: message.createdAt,
                    });
                }

                messagesRemaining -= messages.size;

                if (processed % 500 === 0) {
                    await interaction.editReply(`🔄 Fetching messages: ${processed}/${limit} scanned, ${allScores.length} Wordle posts found...`);
                }

                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            await interaction.editReply(`🔄 Found ${allScores.length} Wordle posts in ${processed} messages. Importing to database...`);

            // Bulk insert with ignoreDuplicates (much faster than individual queries)
            let imported = 0;
            let skipped = 0;

            // Process in batches of 100 for bulk insert
            for (let i = 0; i < allScores.length; i += 100) {
                const batch = allScores.slice(i, i + 100);
                try {
                    const result = await WordleScore.bulkCreate(batch, {
                        ignoreDuplicates: true, // Skip existing entries based on unique index
                    });
                    imported += result.length;
                } catch (err) {
                    // If bulkCreate fails, fall back to individual inserts for this batch
                    for (const scoreData of batch) {
                        try {
                            await WordleScore.findOrCreate({
                                where: {
                                    userId: scoreData.userId,
                                    wordleNumber: scoreData.wordleNumber,
                                },
                                defaults: scoreData,
                            }).then(([, created]) => {
                                if (created) imported++;
                                else skipped++;
                            });
                        } catch (innerErr) {
                            skipped++;
                        }
                    }
                }
            }

            skipped = allScores.length - imported;

            await interaction.editReply(
                `✅ **Sync Complete!**\n` +
                `📨 Messages scanned: ${processed}\n` +
                `🎯 Wordle posts found: ${allScores.length}\n` +
                `✅ Scores imported: ${imported}\n` +
                `⏭️ Already existed: ${skipped}`
            );

        } catch (error) {
            console.error('Error syncing Wordle scores:', error);
            await interaction.editReply(`An error occurred while syncing Wordle scores: ${error.message}`);
        }
    },
};
