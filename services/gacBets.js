/**
 * GAC betting: before Lucas posts his excuse, people bet XP on what it'll be
 * about. When /gac runs, Gemini classifies the excuse and bets are settled.
 */
const { GACBet, User } = require('../models');
const { generateText } = require('./gemini');

const CATEGORIES = {
    pets: '🐾 Pets & Animals',
    home: '🏠 Home & Smart Devices',
    neighbors: '🏘️ Neighbors & HOA',
    vehicle: '🚗 Vehicles',
    delivery: '📦 Deliveries & Packages',
    bureaucracy: '📋 Bureaucracy & Appointments',
    family: '👨‍👩‍👧 Family & Friends',
    other: '🎲 Something Else',
};

const CATEGORY_CHOICES = Object.entries(CATEGORIES).map(([value, name]) => ({ name, value }));

// Net profit multiplier on a correct bet (8 categories, so this is still house-favoured)
const WIN_MULTIPLIER = 4;

async function classifyExcuse(excuse) {
    const prompt = `Classify this excuse for leaving work early into exactly ONE category.

Categories:
${Object.entries(CATEGORIES).map(([key, label]) => `- ${key}: ${label}`).join('\n')}

Excuse: "${excuse}"

Reply with only the category key (e.g. "pets"), nothing else.`;

    try {
        const answer = (await generateText(prompt)).toLowerCase().replace(/[^a-z]/g, '');
        return CATEGORIES[answer] ? answer : 'other';
    }
    catch (error) {
        console.error('Failed to classify GAC excuse:', error);
        return 'other';
    }
}

/** Add (or remove) XP, carrying any overflow through level-ups */
function applyXp(user, delta) {
    user.xp = Math.max(0, user.xp + delta);
    while (user.xp >= 100 * user.level * user.level) {
        user.xp -= 100 * user.level * user.level;
        user.level++;
    }
}

/**
 * Settle every open bet for a day.
 * @param {string} date - GAC date key (toLocaleDateString)
 * @param {string} excuse
 * @returns {Promise<string|null>} Results text for the /gac reply, or null if nobody bet
 */
async function settleBets(date, excuse) {
    const bets = await GACBet.findAll({ where: { date, resolved: false } });
    if (bets.length === 0) return null;

    const category = await classifyExcuse(excuse);
    const lines = [];

    for (const bet of bets) {
        const user = await User.findByPk(bet.userId);
        const won = bet.category === category;
        // Can't lose more XP than you currently hold
        const payout = won ? bet.wager * WIN_MULTIPLIER : -Math.min(bet.wager, user?.xp ?? 0);

        if (user) {
            applyXp(user, payout);
            await user.save();
        }
        await bet.update({ resolved: true, payout });

        lines.push(won ? `✅ <@${bet.userId}> +${payout} XP` : `❌ <@${bet.userId}> ${payout} XP`);
    }

    return `🎲 **Betting results** — the excuse was **${CATEGORIES[category]}**\n${lines.join('\n')}`;
}

module.exports = { CATEGORIES, CATEGORY_CHOICES, WIN_MULTIPLIER, classifyExcuse, settleBets };
