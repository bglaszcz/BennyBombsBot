/**
 * GAC betting: before Lucas posts his excuse, people bet XP on what it'll be
 * about. The wager is taken from the bettor's XP when the bet is placed, so
 * levelling up before settlement can't dodge a loss. When /gac runs, Gemini
 * classifies the excuse and winners get their stake back plus winnings.
 */
const { Op } = require('sequelize');
const { GACBet, User, sequelize } = require('../models');
const { generateText } = require('./gemini');
const { applyXp } = require('../utils/xp');
const { dayKey } = require('../utils/dayKey');

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

/**
 * Place or change today's bet, holding the wager out of the user's XP.
 * Changing a bet refunds the old wager before taking the new one.
 * @returns {Promise<{ error?: string, changed?: boolean }>}
 */
async function placeBet(discordUser, date, category, wager) {
    return sequelize.transaction(async transaction => {
        const lock = { transaction, lock: transaction.LOCK.UPDATE };
        const user = await User.findByPk(discordUser.id, lock);
        const existing = await GACBet.findOne({ where: { date, userId: discordUser.id }, ...lock });

        const available = (user?.xp ?? 0) + (existing ? existing.wager : 0);
        if (!user || wager > available) {
            return { error: `You only have **${available} XP** toward your next level to bet with. Go chat some more. 💬` };
        }

        user.xp = available - wager;
        await user.save({ transaction });

        if (existing) {
            await existing.update({ category, wager }, { transaction });
        }
        else {
            await GACBet.create({ date, userId: discordUser.id, username: discordUser.username, category, wager }, { transaction });
        }
        return { changed: Boolean(existing) };
    });
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
        const won = bet.category === category;
        // Net XP change: the stake was already taken when the bet was placed
        const payout = won ? bet.wager * WIN_MULTIPLIER : -bet.wager;
        let levelsGained = 0;

        if (won) {
            const user = await User.findByPk(bet.userId);
            if (user) {
                levelsGained = applyXp(user, bet.wager + payout);
                await user.save();
            }
        }
        await bet.update({ resolved: true, payout });

        const levelUp = levelsGained > 0 ? ` ⬆️ level up!` : '';
        lines.push(won ? `✅ <@${bet.userId}> +${payout} XP${levelUp}` : `❌ <@${bet.userId}> ${payout} XP`);
    }

    return `🎲 **Betting results** — the excuse was **${CATEGORIES[category]}**\n${lines.join('\n')}`;
}

/** Return held wagers for any earlier day where nobody ran /gac */
async function refundStaleBets() {
    const stale = await GACBet.findAll({ where: { resolved: false, date: { [Op.ne]: dayKey() } } });
    for (const bet of stale) {
        const user = await User.findByPk(bet.userId);
        if (user) {
            applyXp(user, bet.wager);
            await user.save();
        }
        await bet.update({ resolved: true, payout: 0 });
    }
    if (stale.length > 0) console.log(`🎲 Refunded ${stale.length} unsettled GAC bet(s)`);
}

module.exports = {
    CATEGORIES, CATEGORY_CHOICES, WIN_MULTIPLIER, classifyExcuse, placeBet, settleBets,
    gacBetRefundJob: {
        name: 'gac-bet-refunds',
        hour: 0,
        run: refundStaleBets,
    },
};
