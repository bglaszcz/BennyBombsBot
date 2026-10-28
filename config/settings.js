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
        // Where every bet, new market and payout gets logged. Bets can still be placed from
        // any channel; the bettor gets a private confirmation with a link here.
        // Null = post in whatever channel the bet was made (the old behaviour).
        bets: '1565039865924685885',
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

    // Bomb Bucks: a coin balance separate from XP, spent on bets and the shop
    economy: {
        name: 'Bomb Bucks',
        emoji: '💣',
        // New users start with this; existing users got it when the column was added
        startingBalance: 250,
        // Coins per XP-earning message (same 1-minute cooldown as XP)
        chatMin: 2,
        chatMax: 4,
        levelUpBonus: 50,
        // Posting a new Wordle or MapTap score
        scorePostBonus: 10,
    },

    betting: {
        minWager: 5,
        maxWager: 500,
        // Odds are priced from history, then scaled by these (below 1 = house edge).
        // MapTap is lower because there's little history yet — revisit once there are ~1,000 games.
        payoutRates: {
            gac: 0.9,
            wordle: 0.9,
            maptap: 0.8,
            dethtoot: 0.9,
        },
        // GAC odds come from the categories of the last N excuses
        gacOddsSample: 100,
        // Over/under lines are the median of a player's last N games
        lineSampleGames: 30,
        lineMinGames: 5,
        // Custom bets left unsettled this long after closing are refunded
        customSettleGraceHours: 7 * 24,
    },

    shop: {
        prices: {
            gmcEmojis: 150,
            botNickname: 300,
            rigExcuse: 500,
        },
        botNicknameHours: 24,
    },

    // Small Claims Court (right-click a message → Apps → Sue in Small Claims)
    trial: {
        votingMinutes: 15,
        minDamages: 10,
        maxDamages: 250,
        // Plaintiff pays this share of the claim up front; refunded if they win or it's a mistrial
        courtFeeRate: 0.25,
        minCourtFee: 5,
        // If the plaintiff loses, this share of the fee goes to the defendant; the rest is jury duty pay
        defendantShareOfFees: 0.5,
    },

    // What the chat bot remembers about users (services/userMemory.js)
    memory: {
        // Items expire this long after the user last mentioned them
        maxAgeDays: 30,
        // After the bot brings something up, it's labeled "already brought up" for this long
        mentionCooldownDays: 7,
        // At most one "you may bring this up" nudge per user in this window
        nudgeCooldownHours: 12,
        maxFacts: 10,
        maxPreferences: 8,
        maxInsideJokes: 5,
        // Shorter messages skip fact extraction (mention tracking still runs)
        minAnalysisLength: 20,
    },
};
