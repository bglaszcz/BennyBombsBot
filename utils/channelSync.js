/**
 * Shared backfill logic for /wordlesync and /maptapsync: scan a channel's
 * history, parse score posts, insert the new ones and react to them.
 */

/**
 * @param {Object} options
 * @param {import('discord.js').ChatInputCommandInteraction} options.interaction - Already deferred
 * @param {import('discord.js').TextChannel} options.channel
 * @param {number} options.limit - Max messages to scan
 * @param {string} options.label - e.g. "Wordle"
 * @param {(message) => Object|null} options.parse - Message -> row to insert, or null
 * @param {(row) => string} options.keyOf - Unique key matching the table's unique index
 * @param {(rows) => Promise<Set<string>>} options.findExistingKeys - Keys already in the DB
 * @param {(rows) => Promise<void>} options.insert
 * @param {string} options.reaction - Emoji to react to newly imported posts with
 */
async function syncChannelScores({ interaction, channel, limit, label, parse, keyOf, findExistingKeys, insert, reaction }) {
    await interaction.editReply(`🔄 Starting sync... Scanning up to ${limit} messages in ${channel}.`);

    // Keyed by unique score key so a user posting the same puzzle twice only counts once
    const found = new Map();
    const messagesByKey = new Map();
    let processed = 0;
    let lastId = null;

    while (processed < limit) {
        const options = { limit: Math.min(100, limit - processed) };
        if (lastId) options.before = lastId;

        const messages = await channel.messages.fetch(options);
        if (messages.size === 0) break;

        for (const message of messages.values()) {
            processed++;
            lastId = message.id;
            if (message.author.bot) continue;

            const row = parse(message);
            if (!row) continue;

            // Messages arrive newest-first; overwriting keeps the earliest post
            const key = keyOf(row);
            found.set(key, row);
            messagesByKey.set(key, message);
        }

        if (processed % 500 === 0) {
            await interaction.editReply(`🔄 Fetching messages: ${processed}/${limit} scanned, ${found.size} ${label} posts found...`);
        }
    }

    await interaction.editReply(`🔄 Found ${found.size} ${label} posts in ${processed} messages. Importing to database...`);

    const allRows = [...found.values()];
    const existingKeys = allRows.length > 0 ? await findExistingKeys(allRows) : new Set();
    const newRows = allRows.filter(row => !existingKeys.has(keyOf(row)));

    for (let i = 0; i < newRows.length; i += 100) {
        await insert(newRows.slice(i, i + 100));
    }

    // React using the message objects we already fetched — no second fetch per message
    for (const row of newRows) {
        await messagesByKey.get(keyOf(row)).react(reaction).catch(() => {});
    }

    await interaction.editReply(
        `✅ **Sync Complete!**\n` +
        `📨 Messages scanned: ${processed}\n` +
        `🎯 ${label} posts found: ${allRows.length}\n` +
        `✅ Scores imported: ${newRows.length}\n` +
        `⏭️ Already existed: ${allRows.length - newRows.length}`,
    );
}

module.exports = { syncChannelScores };
