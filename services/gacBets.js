/**
 * GAC betting: before Lucas posts his excuse, people bet Bomb Bucks on what
 * it'll be about. Runs on the shared betting service — each day is one
 * fixed-odds market, priced from how often each category has come up before
 * (a flat 4:1 made "home" a near-guaranteed profit). When /gac runs, Gemini
 * classifies the excuse and the market settles; if nobody runs /gac, the
 * midnight sweep refunds everyone.
 */
const { Op } = require('sequelize');
const { BetMarket, GACMessage } = require('../models');
const { generateText } = require('./gemini');
const { findOrCreateMarket, resolveMarket, endOfToday, oddsFor } = require('./bets');
const { betting } = require('../config/settings');

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

const marketKey = date => `gac:${date}`;

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

/** Net payout per category, from the categories of recent excuses */
async function getCategoryOdds() {
    const recent = await GACMessage.findAll({
        where: { category: { [Op.ne]: null } },
        attributes: ['category'],
        order: [['createdAt', 'DESC']],
        limit: betting.gacOddsSample,
        raw: true,
    });
    const keys = Object.keys(CATEGORIES);
    const odds = {};
    for (const key of keys) {
        const hits = recent.filter(r => r.category === key).length;
        // One pseudo-excuse spread evenly across categories: never-seen ones aren't 0%,
        // the probabilities still sum to 1, and with no history every category is 1/8
        const p = (hits + 1 / keys.length) / (recent.length + 1);
        odds[key] = oddsFor(p, betting.payoutRates.gac);
    }
    return odds;
}

/** Today's GAC market (one per day). Odds are locked in when the first bet opens it. */
async function openGacMarket(date, channelId) {
    const existing = await BetMarket.findOne({ where: { key: marketKey(date) } });
    if (existing) return existing;

    const odds = await getCategoryOdds();
    return findOrCreateMarket(marketKey(date), {
        type: 'gac',
        question: "What will Lucas's excuse be about?",
        options: Object.entries(CATEGORIES).map(([value, label]) => ({ value, label, multiplier: odds[value] })),
        closesAt: endOfToday(),
        channelId,
    });
}

/**
 * Settle the day's bets.
 * @param {string} date - GAC day key
 * @param {string} category - The excuse's category (from classifyExcuse)
 * @param {string|null} riggerId - Whoever bought the rigged theme; their own bet is refunded
 * @returns {Promise<string|null>} Results text for the /gac reply, or null if nobody bet
 */
async function settleBets(date, category, riggerId = null) {
    const market = await BetMarket.findOne({ where: { key: marketKey(date), status: 'open' } });
    if (!market) return null;

    const refundNotes = new Map(riggerId ? [[riggerId, 'no betting on your own rigged excuse 🕵️']] : []);
    const result = await resolveMarket(market.id, category, refundNotes);
    return result?.text ?? null;
}

module.exports = { CATEGORIES, CATEGORY_CHOICES, classifyExcuse, getCategoryOdds, openGacMarket, settleBets };
