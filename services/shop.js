/**
 * Bomb Bucks shop. Each item is a one-at-a-time slot stored as a BotState row:
 * creating the row claims the slot, so two buyers can't both get it, and it's
 * done in the same transaction as the charge so a failed purchase costs nothing.
 */
const { UniqueConstraintError } = require('sequelize');
const { BotState, sequelize } = require('../models');
const { adjustCoins, InsufficientFundsError } = require('./economy');
const settings = require('../config/settings');
const { dayKey } = require('../utils/dayKey');

const { prices, botNicknameHours } = settings.shop;

const ITEMS = {
    gmc: {
        name: '🌅 Sponsor tomorrow\'s GMC',
        price: prices.gmcEmojis,
        description: 'Pick the emojis for tomorrow\'s /gmc, with a sponsor credit',
    },
    nickname: {
        name: '🤖 Rename the bot',
        price: prices.botNickname,
        description: `Set my server nickname for ${botNicknameHours} hours`,
    },
    rig: {
        name: '🕵️ Rig the next GAC excuse',
        price: prices.rigExcuse,
        description: 'Secretly decide what Lucas\'s next excuse is about. Insider trading encouraged.',
    },
};

const MAX_GMC_EMOJIS = 6;
const CUSTOM_EMOJI_REGEX = /^<a?:\w+:(\d+)>$/;
const EMOJI_REGEX = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

const gmcKey = date => `shop:gmc:${dayKey(date)}`;
const NICKNAME_KEY = 'shop:nickname';
const RIG_KEY = 'shop:rig';

function tomorrow() {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
}

/**
 * Charge for an item and claim its slot atomically.
 * @param {() => Promise<void>} [apply] - Side effect to perform; throwing rolls back the charge
 * @returns {Promise<{ balance: number } | { error: 'sold-out' } | { error: 'funds', balance: number }>}
 */
async function purchase(discordUser, itemKey, stateKey, value, apply) {
    try {
        const balance = await sequelize.transaction(async transaction => {
            await BotState.create({ key: stateKey, value }, { transaction });
            const newBalance = await adjustCoins(discordUser, -ITEMS[itemKey].price, transaction);
            if (apply) await apply();
            return newBalance;
        });
        return { balance };
    }
    catch (error) {
        if (error instanceof UniqueConstraintError) return { error: 'sold-out' };
        if (error instanceof InsufficientFundsError) return { error: 'funds', balance: error.balance };
        throw error;
    }
}

/**
 * Split user input into emojis, allowing this server's custom emojis.
 * @returns {{ emojis: string[] } | { error: string }}
 */
function parseEmojis(input, guild) {
    const emojis = [];
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

    for (const part of input.split(/(<a?:\w+:\d+>)/)) {
        const custom = part.match(CUSTOM_EMOJI_REGEX);
        if (custom) {
            if (!guild.emojis.cache.has(custom[1])) return { error: 'Custom emojis have to be from this server. 🙅' };
            emojis.push(part);
            continue;
        }
        for (const { segment } of segmenter.segment(part)) {
            if (!segment.trim()) continue;
            if (!EMOJI_REGEX.test(segment)) return { error: `\`${segment}\` isn't an emoji. Emojis only, please. 🙄` };
            emojis.push(segment);
        }
    }

    if (emojis.length === 0) return { error: 'Give me at least one emoji. 🫠' };
    if (emojis.length > MAX_GMC_EMOJIS) return { error: `Max ${MAX_GMC_EMOJIS} emojis — they get mirrored, so it's already double that.` };
    return { emojis };
}

function buyGmcEmojis(discordUser, emojis) {
    return purchase(discordUser, 'gmc', gmcKey(tomorrow()), { emojis, buyerId: discordUser.id });
}

/** @param {import('discord.js').Guild} guild */
function buyBotNickname(discordUser, guild, nickname) {
    const expiresAt = Date.now() + botNicknameHours * 60 * 60 * 1000;
    return purchase(discordUser, 'nickname', NICKNAME_KEY, { nickname, buyerId: discordUser.id, expiresAt },
        () => guild.members.me.setNickname(nickname, `Bought by ${discordUser.username} in the shop`));
}

function buyRiggedExcuse(discordUser, theme) {
    return purchase(discordUser, 'rig', RIG_KEY, { theme, buyerId: discordUser.id });
}

/** @returns {Promise<{ emojis: string[], buyerId: string } | null>} Today's sponsored GMC emojis */
async function getGmcSponsor(date = new Date()) {
    return (await BotState.findByPk(gmcKey(date)))?.value ?? null;
}

/** @returns {Promise<{ theme: string, buyerId: string } | null>} */
async function peekRiggedExcuse() {
    return (await BotState.findByPk(RIG_KEY))?.value ?? null;
}

/** Use up the rigged theme once the excuse has actually been posted */
async function consumeRiggedExcuse() {
    await BotState.destroy({ where: { key: RIG_KEY } });
}

/** What's currently taken, for /shop */
async function getAvailability() {
    const [gmc, nickname, rig] = await Promise.all([
        BotState.findByPk(gmcKey(tomorrow())),
        BotState.findByPk(NICKNAME_KEY),
        BotState.findByPk(RIG_KEY),
    ]);
    return {
        gmc: gmc ? `Sold to <@${gmc.value.buyerId}>` : null,
        nickname: nickname ? `Taken until <t:${Math.floor(nickname.value.expiresAt / 1000)}:t>` : null,
        rig: rig ? 'Someone already rigged the next one 👀' : null,
    };
}

/** Recurring job: put the bot's nickname back when a purchase runs out */
async function expireBotNickname(client) {
    const row = await BotState.findByPk(NICKNAME_KEY);
    if (!row || row.value.expiresAt > Date.now()) return;

    const guild = await client.guilds.fetch(settings.guildId);
    await guild.members.me.setNickname(null, 'Shop nickname expired');
    await row.destroy();
}

module.exports = {
    ITEMS,
    parseEmojis,
    buyGmcEmojis,
    buyBotNickname,
    buyRiggedExcuse,
    getGmcSponsor,
    peekRiggedExcuse,
    consumeRiggedExcuse,
    getAvailability,
    nicknameExpiryJob: {
        name: 'shop-nickname-expiry',
        run: expireBotNickname,
    },
};
