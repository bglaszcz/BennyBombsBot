/**
 * GAC betting: before Lucas posts his excuse, people bet Bomb Bucks on what
 * it'll be about. Runs on the shared betting service — each day is one
 * fixed-odds market. When /gac runs, Gemini classifies the excuse and the
 * market settles; if nobody runs /gac, the midnight sweep refunds everyone.
 */
const { BetMarket } = require('../models');
const { generateText } = require('./gemini');
const { findOrCreateMarket, resolveMarket, endOfToday } = require('./bets');
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

/** Today's GAC market (one per day) */
function openGacMarket(date, channelId) {
    return findOrCreateMarket(marketKey(date), {
        type: 'gac',
        question: "What will Lucas's excuse be about?",
        options: Object.entries(CATEGORIES).map(([value, label]) => ({ value, label, multiplier: betting.gacMultiplier })),
        closesAt: endOfToday(),
        channelId,
    });
}

/**
 * Settle the day's bets against the excuse.
 * @param {string} date - GAC day key
 * @returns {Promise<string|null>} Results text for the /gac reply, or null if nobody bet
 */
async function settleBets(date, excuse) {
    const market = await BetMarket.findOne({ where: { key: marketKey(date), status: 'open' } });
    if (!market) return null;

    const category = await classifyExcuse(excuse);
    const result = await resolveMarket(market.id, category);
    return result?.text ?? null;
}

module.exports = { CATEGORIES, CATEGORY_CHOICES, classifyExcuse, openGacMarket, settleBets };
