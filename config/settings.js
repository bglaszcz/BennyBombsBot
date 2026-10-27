/**
 * Non-secret bot settings: channel/role IDs, schedules and tunables.
 * Secrets (token, API keys, DB credentials) stay in config.json.
 *
 * Anything set to null is optional — the feature that needs it stays
 * switched off until you fill it in.
 */
const { guildId } = require('../config.json');

module.exports = {
    guildId,

    channels: {
        wordle: '930279618437586974',
        maptap: '1528771977995620574',
        // Daily "Morning Gazette" recap post
        gazette: null,
        // Hall of fame for heavily-reacted messages
        starboard: null,
    },

    roles: {
        // Weekly champion roles — the bot needs Manage Roles and must sit above these roles
        wordleChampion: null,
        maptapChampion: null,
    },

    starboard: {
        threshold: 4,
        emojis: ['💀', '😂', '🤣'],
    },

    schedule: {
        // Hours are server-local time (24h)
        wordleReminderHour: 21,
        gazetteHour: 8,
        // Weekly champions post Sunday night
        championsWeekday: 0,
        championsHour: 22,
    },

    xp: {
        min: 15,
        max: 25,
        cooldownMs: 60 * 1000,
    },

    image: {
        dailyLimitPerUser: 10,
    },
};
