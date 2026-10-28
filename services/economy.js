/**
 * Bomb Bucks: the coin balance on each User row. Every change goes through
 * adjustCoins so balances are locked while they change and can't go negative.
 */
const { User, sequelize } = require('../models');
const { economy } = require('../config/settings');

class InsufficientFundsError extends Error {
    constructor(balance, needed) {
        super(`Insufficient funds: have ${balance}, need ${needed}`);
        this.name = 'InsufficientFundsError';
        this.balance = balance;
        this.needed = needed;
    }
}

/** e.g. "**250** 💣" */
function formatCoins(amount) {
    return `**${amount.toLocaleString('en-US')}** ${economy.emoji}`;
}

/** Run fn inside the given transaction, or a new one */
function withTransaction(transaction, fn) {
    return transaction ? fn(transaction) : sequelize.transaction(fn);
}

/** @returns {Promise<number>} Balance, or the starting balance for someone not yet in the Users table */
async function getBalance(userId) {
    const user = await User.findByPk(userId, { attributes: ['coins'] });
    return user ? user.coins : economy.startingBalance;
}

/**
 * Add (positive) or spend (negative) coins.
 * @param {{ id: string, username: string }} discordUser
 * @param {number} delta
 * @param {import('sequelize').Transaction} [transaction]
 * @returns {Promise<number>} New balance
 * @throws {InsufficientFundsError} When spending more than the balance
 */
function adjustCoins(discordUser, delta, transaction) {
    return withTransaction(transaction, async t => {
        let user = await User.findByPk(discordUser.id, { transaction: t, lock: t.LOCK.UPDATE });
        if (!user) {
            user = await User.create({ userId: discordUser.id, username: discordUser.username }, { transaction: t });
        }
        if (user.coins + delta < 0) throw new InsufficientFundsError(user.coins, -delta);

        user.coins += delta;
        await user.save({ transaction: t });
        return user.coins;
    });
}

/** Top balances for /wallet */
function getRichest(limit = 5) {
    return User.findAll({ attributes: ['userId', 'username', 'coins'], order: [['coins', 'DESC']], limit, raw: true });
}

module.exports = { InsufficientFundsError, formatCoins, withTransaction, getBalance, adjustCoins, getRichest };
