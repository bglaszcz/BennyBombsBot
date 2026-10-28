/**
 * Betting service. Every bet belongs to a BetMarket. Wagers come out of the
 * bettor's Bomb Bucks when placed; settling pays winners their stake back plus
 * winnings, and voiding refunds everyone.
 *
 * Payout modes:
 * - fixed: each option carries a net multiplier priced from history (GAC categories,
 *          over/unders, deth toots) — see oddsFor()
 * - pool:  winners split the losers' stakes pro rata (custom yes/no bets)
 *
 * Lock order is always market row → user rows, so bets and settlements can't deadlock.
 */
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { Op, UniqueConstraintError } = require('sequelize');
const { Bet, BetMarket, WordleScore, MapTapScore, DethTootLog, sequelize } = require('../models');
const { adjustCoins, formatCoins, InsufficientFundsError } = require('./economy');
const { localDateKey } = require('./scheduler');
const { betting, channels } = require('../config/settings');
const { getWordleNumber } = require('../utils/wordle');
const { getNickname } = require('../utils/getNickname');
const { fetchMessage } = require('../utils/messages');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function endOfToday() {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end;
}

function isOpen(market) {
    return market.status === 'open' && (!market.closesAt || market.closesAt > new Date());
}

function optionLabel(market, value) {
    return market.options.find(o => o.value === value)?.label ?? value;
}

/**
 * Net payout per coin for an outcome with probability p: fair odds scaled by
 * the payout rate (below 1 = house edge), rounded to 0.1 and capped at 10:1.
 */
function oddsFor(p, payoutRate) {
    const fair = (1 - p) / p;
    return Math.min(10, Math.max(0.1, Math.round(fair * payoutRate * 10) / 10));
}

/** Probability from k hits in n tries, smoothed so small samples never say 0% or 100% */
function smoothedProbability(k, n) {
    return (k + 1) / (n + 2);
}

/** Auto markets are keyed so everyone's bets on the same event land in one row */
async function findOrCreateMarket(key, defaults) {
    const existing = await BetMarket.findOne({ where: { key } });
    if (existing) return existing;
    try {
        return await BetMarket.create({ ...defaults, key });
    }
    catch (error) {
        if (!(error instanceof UniqueConstraintError)) throw error;
        return BetMarket.findOne({ where: { key } });
    }
}

/**
 * Place or change a bet. Changing refunds the old wager before taking the new one.
 * @returns {Promise<{ error: string } | { changed: boolean, balance: number }>}
 */
async function placeBet(market, discordUser, choice, wager) {
    if (!market.options.some(o => o.value === choice)) return { error: "That's not one of the options. 🤨" };
    if (wager < betting.minWager || wager > betting.maxWager) {
        return { error: `Wagers must be between ${formatCoins(betting.minWager)} and ${formatCoins(betting.maxWager)}.` };
    }

    try {
        return await sequelize.transaction(async transaction => {
            const lock = { transaction, lock: transaction.LOCK.UPDATE };
            // Re-read under lock so a bet can't slip in after the market settles
            const current = await BetMarket.findByPk(market.id, lock);
            if (!current || !isOpen(current)) return { error: 'Betting on that is closed. 🔒' };

            const existing = await Bet.findOne({ where: { marketId: market.id, userId: discordUser.id }, ...lock });
            const balance = await adjustCoins(discordUser, (existing?.wager ?? 0) - wager, transaction);

            if (existing) {
                await existing.update({ choice, wager }, { transaction });
            }
            else {
                await Bet.create({ marketId: market.id, userId: discordUser.id, username: discordUser.username, choice, wager }, { transaction });
            }
            return { changed: Boolean(existing), balance };
        });
    }
    catch (error) {
        if (!(error instanceof InsufficientFundsError)) throw error;
        // error.needed is the extra beyond any wager being replaced
        const available = error.balance + wager - error.needed;
        return { error: `You only have ${formatCoins(available)} to bet with. Go chat some more. 💬` };
    }
}

/**
 * Net result per bet, or all zeros when a pool has nobody on one side.
 * @returns {{ nets: Map<number, number>, refunded: boolean }}
 */
function computeNets(market, bets, outcome) {
    const nets = new Map();

    if (market.payoutMode === 'pool') {
        const pot = bets.reduce((sum, b) => sum + b.wager, 0);
        const winningStake = bets.filter(b => b.choice === outcome).reduce((sum, b) => sum + b.wager, 0);
        // Nobody to win from (or nobody won): give everyone their stake back
        if (winningStake === 0 || winningStake === pot) {
            for (const bet of bets) nets.set(bet.id, 0);
            return { nets, refunded: true };
        }
        for (const bet of bets) {
            nets.set(bet.id, bet.choice === outcome
                ? Math.floor(bet.wager / winningStake * (pot - winningStake))
                : -bet.wager);
        }
        return { nets, refunded: false };
    }

    const multiplier = market.options.find(o => o.value === outcome)?.multiplier ?? 0;
    for (const bet of bets) {
        nets.set(bet.id, bet.choice === outcome ? Math.floor(bet.wager * multiplier) : -bet.wager);
    }
    return { nets, refunded: false };
}

function summarize(market, bets, nets, outcome, refunded, refundNotes) {
    if (bets.length === 0) return null;

    if (outcome === null) {
        return `🚫 **Bet called off:** ${market.question}\nAll ${bets.length} wager${bets.length !== 1 ? 's' : ''} refunded.`;
    }

    const lines = bets.map(bet => {
        const net = nets.get(bet.id);
        if (refundNotes.has(bet.userId)) return `↩️ <@${bet.userId}> refunded ${formatCoins(bet.wager)} — ${refundNotes.get(bet.userId)}`;
        if (refunded) return `↩️ <@${bet.userId}> refunded ${formatCoins(bet.wager)}`;
        return net >= 0
            ? `✅ <@${bet.userId}> +${formatCoins(net)}`
            : `❌ <@${bet.userId}> -${formatCoins(-net)}`;
    });
    const note = refunded ? '\n-# Nobody on the other side, so everyone got their stake back.' : '';
    return `🎲 **${market.question}** → **${optionLabel(market, outcome)}**\n${lines.join('\n')}${note}`;
}

/**
 * Settle a market with an outcome, or void it (outcome null) to refund everyone.
 * @param {Map<string, string>} [refundNotes] - userId -> reason; these bettors get their stake back
 *   and are left out of the payout (e.g. whoever rigged the GAC excuse)
 * @returns {Promise<{ market, text: string|null } | null>} null if it was already settled
 */
async function resolveMarket(marketId, outcome, refundNotes = new Map()) {
    return sequelize.transaction(async transaction => {
        const market = await BetMarket.findByPk(marketId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!market || market.status === 'settled' || market.status === 'void') return null;

        const bets = await Bet.findAll({ where: { marketId, resolved: false }, order: [['wager', 'DESC']], transaction });
        const counted = bets.filter(b => !refundNotes.has(b.userId));
        const { nets, refunded } = outcome === null
            ? { nets: new Map(bets.map(b => [b.id, 0])), refunded: false }
            : computeNets(market, counted, outcome);
        for (const bet of bets) if (!nets.has(bet.id)) nets.set(bet.id, 0);

        for (const bet of bets) {
            const net = nets.get(bet.id);
            // Stake was taken up front: winners and refunds get it back, losers get nothing
            const credit = net >= 0 ? bet.wager + net : 0;
            if (credit > 0) await adjustCoins({ id: bet.userId, username: bet.username }, credit, transaction);
            await bet.update({ resolved: true, payout: net }, { transaction });
        }

        await market.update({ status: outcome === null ? 'void' : 'settled', outcome }, { transaction });
        return { market, text: summarize(market, bets, nets, outcome, refunded, refundNotes) };
    });
}

async function announce(client, channelId, text) {
    if (!text || !channelId) return;
    try {
        const channel = await client.channels.fetch(channelId);
        await channel.send({ content: text, allowedMentions: { parse: [] } });
    }
    catch (error) {
        console.error('Could not announce bet results:', error.message);
    }
}

/** Where a market's posts and results go: the bets channel if one is set, else where it was opened */
function betsChannelFor(channelId) {
    return channels.bets ?? channelId;
}

/**
 * Log a bet (or market, or result) in the bets channel and confirm privately to whoever
 * made it. In the bets channel itself, or with none configured, it's a normal public reply.
 * @returns {Promise<import('discord.js').Message|null>} The public post
 */
async function postBetRecord(interaction, payload) {
    const target = channels.bets;
    if (target && target !== interaction.channelId) {
        try {
            const channel = await interaction.client.channels.fetch(target);
            const message = await channel.send({ ...payload, allowedMentions: { parse: [] } });
            await interaction.reply({ content: `🎲 Done! Logged in ${message.url}`, flags: MessageFlags.Ephemeral });
            return message;
        }
        catch (error) {
            console.error('Could not post to the bets channel, replying here instead:', error.message);
        }
    }
    const response = await interaction.reply({ ...payload, withResponse: true });
    return response.resource?.message ?? null;
}

// ---------------------------------------------------------------------------
// Over/under markets on a player's Wordle or MapTap score
// ---------------------------------------------------------------------------

const SCORE_MARKETS = {
    wordle: {
        label: 'Wordle',
        todayKey: () => String(getWordleNumber()),
        async alreadyPosted(userId, puzzleKey) {
            return Boolean(await WordleScore.findOne({ where: { userId, wordleNumber: Number(puzzleKey) } }));
        },
        async recentScores(userId) {
            const rows = await WordleScore.findAll({
                where: { userId }, order: [['wordleNumber', 'DESC']], limit: betting.lineSampleGames, attributes: ['score'], raw: true,
            });
            return rows.map(r => r.score);
        },
        // Integer scores 1-7; keep the line inside the possible range
        clampLine: line => Math.min(6.5, Math.max(1.5, line)),
        question: (name, puzzleKey, line) => `${name} on Wordle #${puzzleKey}: over/under ${line}`,
        labels: line => ({ under: `Under ${line} (sharp)`, over: `Over ${line} (struggles)` }),
    },
    maptap: {
        label: 'MapTap',
        todayKey: () => localDateKey(),
        async alreadyPosted(userId, puzzleKey) {
            return Boolean(await MapTapScore.findOne({ where: { userId, puzzleDate: puzzleKey } }));
        },
        async recentScores(userId) {
            const rows = await MapTapScore.findAll({
                where: { userId }, order: [['puzzleDate', 'DESC']], limit: betting.lineSampleGames, attributes: ['finalScore'], raw: true,
            });
            return rows.map(r => r.finalScore);
        },
        clampLine: line => line,
        question: (name, puzzleKey, line) => `${name} on today's MapTap: over/under ${line}`,
        labels: line => ({ over: `Over ${line} (cartographer)`, under: `Under ${line} (lost)` }),
    },
};

/** @returns {Promise<{ error: string } | { market }>} Today's over/under market for a player */
async function openScoreMarket(type, player, channelId) {
    const config = SCORE_MARKETS[type];
    const name = getNickname(player.id, player.username);
    const puzzleKey = config.todayKey();

    if (await config.alreadyPosted(player.id, puzzleKey)) {
        return { error: `${name} already posted today's ${config.label}. Too late! ⏰` };
    }

    const key = `${type}:${puzzleKey}:${player.id}`;
    const existing = await BetMarket.findOne({ where: { key } });
    if (existing) return { market: existing };

    const scores = await config.recentScores(player.id);
    if (scores.length < betting.lineMinGames) {
        return { error: `${name} needs at least ${betting.lineMinGames} ${config.label} games on record before I can set a line. 📏` };
    }

    // The median, not the mean: MapTap's occasional disaster round drags the mean below a
    // typical game, which made "over" a near-free win. Each side is then priced from how
    // often it would have hit across these same games.
    const sorted = [...scores].sort((a, b) => a - b);
    const line = config.clampLine(sorted[Math.floor(sorted.length / 2)] + 0.5);
    const pUnder = smoothedProbability(scores.filter(s => s < line).length, scores.length);
    const rate = betting.payoutRates[type];
    const labels = config.labels(line);

    const market = await findOrCreateMarket(key, {
        type,
        question: config.question(name, puzzleKey, line),
        subjectUserId: player.id,
        line,
        options: [
            { value: 'under', label: labels.under, multiplier: oddsFor(pUnder, rate) },
            { value: 'over', label: labels.over, multiplier: oddsFor(1 - pUnder, rate) },
        ],
        // Voided at midnight if they never post
        closesAt: endOfToday(),
        channelId,
    });
    return { market };
}

/** Called by the score trackers when a new score is stored */
async function settleScoreMarket(client, type, userId, puzzleKey, score) {
    const market = await BetMarket.findOne({ where: { key: `${type}:${puzzleKey}:${userId}`, status: 'open' } });
    if (!market) return;
    const result = await resolveMarket(market.id, score < market.line ? 'under' : 'over');
    await announce(client, market.channelId, result?.text);
}

// ---------------------------------------------------------------------------
// Deth toot within 24 hours
// ---------------------------------------------------------------------------

/** Chance the player toots in the next 24h, from their recent toot rate */
async function dethTootProbability(userId) {
    const now = Date.now();
    const windowStart = new Date(now - 90 * DAY_MS);
    const [count, firstLog] = await Promise.all([
        DethTootLog.count({ where: { userId, tootedAt: { [Op.gte]: windowStart } } }),
        DethTootLog.min('tootedAt'),
    ]);
    // Only count days we were actually tracking, with a floor so a new log isn't overconfident
    const trackedSince = Math.max(windowStart.getTime(), firstLog ? new Date(firstLog).getTime() : now);
    const days = Math.min(90, Math.max(7, (now - trackedSince) / DAY_MS));
    const dailyRate = Math.max(count, 0.5) / days;
    return Math.min(0.95, Math.max(0.05, 1 - Math.exp(-dailyRate)));
}

/** The open 24h deth toot market for a player, opening one if needed */
async function openDethTootMarket(player, channelId) {
    const existing = await BetMarket.findOne({
        where: { type: 'dethtoot', subjectUserId: player.id, status: 'open', closesAt: { [Op.gt]: new Date() } },
    });
    if (existing) return existing;

    const p = await dethTootProbability(player.id);
    return BetMarket.create({
        type: 'dethtoot',
        key: `dethtoot:${player.id}:${Date.now()}`,
        question: `Will ${getNickname(player.id, player.username)} deth toot in the next 24 hours?`,
        subjectUserId: player.id,
        options: [
            { value: 'yes', label: 'Toots 💨', multiplier: oddsFor(p, betting.payoutRates.dethtoot) },
            { value: 'no', label: 'Stays clean 🧘', multiplier: oddsFor(1 - p, betting.payoutRates.dethtoot) },
        ],
        closesAt: new Date(Date.now() + DAY_MS),
        channelId,
    });
}

/** Called by the deth toot event */
async function settleDethTootMarket(client, userId) {
    const market = await BetMarket.findOne({
        where: { type: 'dethtoot', subjectUserId: userId, status: 'open', closesAt: { [Op.gt]: new Date() } },
    });
    if (!market) return;
    const result = await resolveMarket(market.id, 'yes');
    await announce(client, market.channelId, result?.text);
}

// ---------------------------------------------------------------------------
// Custom yes/no markets
// ---------------------------------------------------------------------------

function createCustomMarket(creator, question, hours, channelId) {
    return BetMarket.create({
        type: 'custom',
        question,
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
        payoutMode: 'pool',
        closesAt: new Date(Date.now() + hours * HOUR_MS),
        creatorId: creator.id,
        channelId,
    });
}

/** Embed + Yes/No buttons for a custom market's post */
async function customMarketPayload(market) {
    const bets = await Bet.findAll({ where: { marketId: market.id }, raw: true });
    const pools = market.options.map(option => {
        const onSide = bets.filter(b => b.choice === option.value);
        const total = onSide.reduce((sum, b) => sum + b.wager, 0);
        return { option, total, count: onSide.length };
    });

    const closesUnix = Math.floor(market.closesAt.getTime() / 1000);
    const statusLine = {
        open: `Betting closes <t:${closesUnix}:R>`,
        locked: `Betting closed — waiting for <@${market.creatorId}> to settle it`,
        settled: `Settled: **${optionLabel(market, market.outcome)}**`,
        void: 'Called off — everyone was refunded',
    }[market.status];

    const embed = new EmbedBuilder()
        .setColor(market.status === 'open' ? 0x5865F2 : 0x747F8D)
        .setTitle(`🎲 ${market.question}`)
        .setDescription(`${statusLine}\nWinners split the losing side's pot.`)
        .addFields(pools.map(({ option, total, count }) => ({
            name: option.label,
            value: `${formatCoins(total)} from ${count} bettor${count !== 1 ? 's' : ''}`,
            inline: true,
        })))
        .setFooter({ text: `Market #${market.id} • opened by a degenerate` });

    const buttons = new ActionRowBuilder().addComponents(market.options.map(option =>
        new ButtonBuilder()
            .setCustomId(`bet-pick:${market.id}:${option.value}`)
            .setLabel(`Bet ${option.label}`)
            .setStyle(option.value === 'yes' ? ButtonStyle.Success : ButtonStyle.Danger)
            .setDisabled(!isOpen(market)),
    ));

    return { embeds: [embed], components: [buttons] };
}

async function refreshMarketPost(client, market) {
    if (!market.messageId) return;
    const message = await fetchMessage(client, market.channelId, market.messageId);
    if (message) await message.edit(await customMarketPayload(market)).catch(() => {});
}

// ---------------------------------------------------------------------------
// Expiry sweep (runs every scheduler tick)
// ---------------------------------------------------------------------------

async function sweepMarkets(client) {
    const now = new Date();
    const expired = await BetMarket.findAll({
        where: { status: { [Op.in]: ['open', 'locked'] }, closesAt: { [Op.lte]: now } },
    });

    for (const market of expired) {
        if (market.type === 'custom') {
            const graceOver = now - market.closesAt > betting.customSettleGraceHours * HOUR_MS;
            if (graceOver) {
                const result = await resolveMarket(market.id, null);
                await refreshMarketPost(client, result?.market ?? market);
                await announce(client, market.channelId, result?.text);
            }
            else if (market.status === 'open') {
                await market.update({ status: 'locked' });
                await refreshMarketPost(client, market);
            }
            continue;
        }

        // A deth toot window that ran out means they stayed clean; anything else just never happened
        const result = await resolveMarket(market.id, market.type === 'dethtoot' ? 'no' : null);
        await announce(client, market.channelId, result?.text);
    }
}

/** Open markets and the caller's unresolved bets, for /bet list and /wallet */
async function getOpenBets(userId) {
    const bets = await Bet.findAll({ where: { userId, resolved: false }, raw: true });
    if (bets.length === 0) return [];
    const markets = await BetMarket.findAll({ where: { id: bets.map(b => b.marketId) } });
    const byId = new Map(markets.map(m => [m.id, m]));
    return bets.map(bet => ({ bet, market: byId.get(bet.marketId) })).filter(x => x.market);
}

/**
 * Open markets for /bet list. Deth toot markets are secret (knowing about one could change
 * whether someone toots), so they only show up for people who bet on them.
 */
async function listOpenMarkets(viewerId) {
    const myBets = await Bet.findAll({ where: { userId: viewerId, resolved: false }, attributes: ['marketId'], raw: true });
    return BetMarket.findAll({
        where: {
            status: { [Op.in]: ['open', 'locked'] },
            [Op.or]: [{ type: { [Op.ne]: 'dethtoot' } }, { id: myBets.map(b => b.marketId) }],
        },
        order: [['closesAt', 'ASC']],
        limit: 15,
    });
}

module.exports = {
    isOpen,
    optionLabel,
    oddsFor,
    smoothedProbability,
    findOrCreateMarket,
    placeBet,
    resolveMarket,
    announce,
    betsChannelFor,
    postBetRecord,
    endOfToday,
    openScoreMarket,
    settleScoreMarket,
    openDethTootMarket,
    settleDethTootMarket,
    createCustomMarket,
    customMarketPayload,
    refreshMarketPost,
    getOpenBets,
    listOpenMarkets,
    marketSweepJob: {
        name: 'bet-market-sweep',
        run: sweepMarkets,
    },
};
