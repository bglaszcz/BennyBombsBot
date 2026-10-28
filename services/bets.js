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
const { betting, channels, guildId } = require('../config/settings');
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
            // Quiet by default; a payload can opt in to pinging specific people
            const message = await channel.send({ allowedMentions: { parse: [] }, ...payload });
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
//
// Settling works by proposal: anyone involved (the creator or a bettor) calls the
// result, which pays out after a dispute window unless someone involved disputes it.
// If everyone involved agrees, it pays out right away. A disputed bet waits for an
// admin; admins' calls are always final and immediate.
//
// Status: open → locked (betting closed) → pending (result called) → settled
//                                                   ↘ disputed → settled by an admin
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = ['open', 'locked', 'pending', 'disputed'];

/**
 * @param {Date} closesAt - When betting stops
 * @param {Date|null} settleAt - When the answer should be known; the creator gets pinged then
 */
function createCustomMarket(creator, question, closesAt, settleAt, channelId) {
    return BetMarket.create({
        type: 'custom',
        question,
        options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }],
        payoutMode: 'pool',
        closesAt,
        settleAt,
        creatorId: creator.id,
        channelId,
    });
}

/** When a custom market should be settled: its settle time, or when betting closes */
function settleDueAt(market) {
    return market.settleAt ?? market.closesAt;
}

function outcomeLabel(market, outcome) {
    return outcome === 'void' ? 'Call it off (refund everyone)' : optionLabel(market, outcome);
}

/** The creator plus everyone who bet — the people who get a say in the result */
async function involvedIds(market, transaction) {
    const bettors = await Bet.findAll({ where: { marketId: market.id }, attributes: ['userId'], raw: true, transaction });
    return [...new Set([market.creatorId, ...bettors.map(b => b.userId)].filter(Boolean))];
}

/** "Yes / No / Call it off / Not yet" buttons for the settle reminder */
function settleButtons(marketId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`bet-settle:${marketId}:yes`).setLabel('Yes').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`bet-settle:${marketId}:no`).setLabel('No').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`bet-settle:${marketId}:void`).setLabel('Call it off (refund)').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bet-settle:${marketId}:snooze`).setLabel('Not yet — ask tomorrow').setEmoji('😴').setStyle(ButtonStyle.Secondary),
    );
}

/** Ping the creator to call the result, with one-tap buttons */
async function sendSettleReminder(client, market) {
    if (!market.channelId) return;
    const link = market.messageId ? ` ([the bet](https://discord.com/channels/${guildId}/${market.channelId}/${market.messageId}))` : '';
    const refundAt = Math.floor((settleDueAt(market).getTime() + betting.customSettleGraceHours * HOUR_MS) / 1000);
    const nag = market.remindedAt ? 'Still waiting on you,' : 'Time to settle up,';
    try {
        const channel = await client.channels.fetch(market.channelId);
        await channel.send({
            content: `⏰ ${nag} <@${market.creatorId}>! How did it go?\n> ${market.question}${link}\n` +
                `-# Anyone in the bet can make the call, and anyone else in it has ${betting.disputeWindowHours}h to dispute. ` +
                `If nobody calls it, everyone's refunded <t:${refundAt}:R>.`,
            components: [settleButtons(market.id)],
            allowedMentions: { users: [market.creatorId] },
        });
    }
    catch (error) {
        console.error('Could not send settle reminder:', error.message);
    }
}

/** The public "X says the answer is Y" post with Agree / Dispute buttons */
function proposalPayload(market, involved) {
    const { outcome, by, endsAt, agreed } = market.proposal;
    const others = involved.filter(id => id !== by);
    const endsUnix = Math.floor(new Date(endsAt).getTime() / 1000);
    return {
        content: `⚖️ <@${by}> says the answer is **${outcomeLabel(market, outcome)}**\n> ${market.question}\n` +
            `Pays out <t:${endsUnix}:R> unless someone disputes. ✅ ${agreed.length}/${involved.length} agree — if everyone does, it pays out now.` +
            (others.length ? `\n-# ${others.map(id => `<@${id}>`).join(' ')} — you're in this bet, so you can agree or dispute.` : ''),
        components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`bet-agree:${market.id}`).setLabel('Agree').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`bet-dispute:${market.id}`).setLabel('Dispute').setEmoji('⚠️').setStyle(ButtonStyle.Danger),
        )],
        allowedMentions: { users: others },
    };
}

/**
 * Someone involved calls the result. Locks betting and starts the dispute window.
 * @returns {Promise<{ error: string } | { market, involved: string[], final: boolean }>}
 *   final = they're the only one involved, so there's nobody to dispute it
 */
async function proposeOutcome(marketId, userId, outcome) {
    return sequelize.transaction(async transaction => {
        const market = await BetMarket.findByPk(marketId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!market) return { error: 'No market with that number. 🤔' };
        if (market.type !== 'custom') return { error: 'That market settles itself. Admins can only void it.' };
        if (market.status === 'pending') return { error: 'Someone already called it — agree or dispute their call instead.' };
        if (market.status === 'disputed') return { error: 'That one\'s disputed, so an admin has to make the call. 🧑‍⚖️' };
        if (!['open', 'locked'].includes(market.status)) return { error: 'That one\'s already been settled.' };

        const involved = await involvedIds(market, transaction);
        if (!involved.includes(userId)) return { error: 'Only the creator and people who bet on it can call the result. 🙅' };

        const endsAt = new Date(Date.now() + betting.disputeWindowHours * HOUR_MS);
        await market.update({
            status: 'pending',
            proposal: { outcome, by: userId, endsAt: endsAt.toISOString(), agreed: [userId] },
        }, { transaction });
        return { market, involved, final: involved.length === 1 };
    });
}

/** Remember where the proposal post is, so its buttons can be cleared later */
async function setProposalMessage(market, message) {
    await market.update({ proposal: { ...market.proposal, channelId: message.channelId, messageId: message.id } });
}

/**
 * Agree with or dispute the current call.
 * @returns {Promise<{ error: string, stale?: boolean } | { market, involved: string[], final?: boolean, disputed?: boolean }>}
 */
async function respondToProposal(marketId, userId, action) {
    return sequelize.transaction(async transaction => {
        const market = await BetMarket.findByPk(marketId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!market || market.status !== 'pending') return { error: 'That call isn\'t up for debate anymore.', stale: true };

        const involved = await involvedIds(market, transaction);
        if (!involved.includes(userId)) return { error: 'Only the creator and people who bet on it get a say. 🙅' };

        const proposal = market.proposal;
        if (action === 'dispute') {
            if (userId === proposal.by) return { error: 'You can\'t dispute your own call. Ask an admin if you got it wrong.' };
            await market.update({
                status: 'disputed',
                proposal: { ...proposal, disputedBy: userId, disputedAt: new Date().toISOString() },
            }, { transaction });
            return { market, involved, disputed: true };
        }

        if (proposal.agreed.includes(userId)) return { error: 'You already agreed. 👍' };
        const agreed = [...proposal.agreed, userId];
        await market.update({ proposal: { ...proposal, agreed } }, { transaction });
        return { market, involved, final: involved.every(id => agreed.includes(id)) };
    });
}

/** Strip the Agree/Dispute buttons off a proposal post once it's decided */
async function closeProposalPost(client, market) {
    const proposal = market.proposal;
    if (!proposal?.messageId) return;
    const message = await fetchMessage(client, proposal.channelId, proposal.messageId);
    if (message?.components.length) {
        await message.edit({ content: `${message.content}\n🔒 Final.`, components: [], allowedMentions: { parse: [] } }).catch(() => null);
    }
}

/**
 * Pay out (or refund, outcome 'void') right now. Used for admin rulings, unanimous
 * agreement, and dispute windows that ran out.
 * @returns {Promise<string|null>} Results text, or null if it was already settled
 */
async function settleMarketNow(client, market, outcome) {
    const result = await resolveMarket(market.id, outcome === 'void' ? null : outcome);
    if (!result) return null;
    await refreshMarketPost(client, result.market);
    await closeProposalPost(client, result.market);
    return result.text ?? `🎲 **${market.question}** settled — nobody had bet on it.`;
}

/** One-line status for the bet post and /bet list */
function customStatusLine(market) {
    const closesUnix = Math.floor(market.closesAt.getTime() / 1000);
    const settleUnix = Math.floor(settleDueAt(market).getTime() / 1000);
    const settleNote = market.settleAt && market.settleAt > market.closesAt ? ` • settles <t:${settleUnix}:f>` : '';
    switch (market.status) {
        case 'open': return `Betting closes <t:${closesUnix}:R>${settleNote}`;
        case 'locked': return `Betting closed — result due <t:${settleUnix}:R>`;
        case 'pending': {
            const endsUnix = Math.floor(new Date(market.proposal.endsAt).getTime() / 1000);
            return `<@${market.proposal.by}> called it **${outcomeLabel(market, market.proposal.outcome)}** — pays out <t:${endsUnix}:R> unless disputed`;
        }
        case 'disputed': return `⚠️ Disputed by <@${market.proposal.disputedBy}> — an admin has to rule with \`/bet settle market:${market.id}\``;
        case 'settled': return `Settled: **${optionLabel(market, market.outcome)}**`;
        default: return 'Called off — everyone was refunded';
    }
}

/** Embed + Yes/No buttons for a custom market's post */
async function customMarketPayload(market) {
    const bets = await Bet.findAll({ where: { marketId: market.id }, raw: true });
    const pools = market.options.map(option => {
        const onSide = bets.filter(b => b.choice === option.value);
        const total = onSide.reduce((sum, b) => sum + b.wager, 0);
        return { option, total, count: onSide.length };
    });

    const embed = new EmbedBuilder()
        .setColor({ open: 0x5865F2, pending: 0xF1C40F, disputed: 0xE67E22 }[market.status] ?? 0x747F8D)
        .setTitle(`🎲 ${market.question}`)
        .setDescription(`${customStatusLine(market)}\nWinners split the losing side's pot.`)
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
    if (message) await message.edit(await customMarketPayload(market)).catch(() => null);
}

// ---------------------------------------------------------------------------
// Expiry sweep (runs every scheduler tick)
// ---------------------------------------------------------------------------

/**
 * Custom markets: pay out calls whose dispute window ran out, lock when betting closes,
 * ping the creator from the settle time on, and refund everyone after the grace period.
 */
async function sweepCustomMarket(client, market, now) {
    if (market.status === 'pending') {
        if (new Date(market.proposal.endsAt) <= now) {
            await announce(client, market.channelId, await settleMarketNow(client, market, market.proposal.outcome));
        }
        return;
    }

    // A dispute restarts the clock so admins get the full grace period to rule
    const due = settleDueAt(market);
    const disputedAt = market.proposal?.disputedAt ? new Date(market.proposal.disputedAt) : null;
    const graceStart = disputedAt && disputedAt > due ? disputedAt : due;
    if (now - graceStart > betting.customSettleGraceHours * HOUR_MS) {
        await announce(client, market.channelId, await settleMarketNow(client, market, 'void'));
        return;
    }
    if (market.status === 'disputed') return;

    if (market.status === 'open' && market.closesAt <= now) {
        await market.update({ status: 'locked' });
        await refreshMarketPost(client, market);
    }
    if (due <= now && (!market.remindedAt || now - market.remindedAt >= betting.settleReminderEveryHours * HOUR_MS)) {
        await sendSettleReminder(client, market);
        await market.update({ remindedAt: now });
    }
}

async function sweepMarkets(client) {
    const now = new Date();
    const due = await BetMarket.findAll({
        where: {
            status: { [Op.in]: ACTIVE_STATUSES },
            [Op.or]: [
                { closesAt: { [Op.lte]: now } },
                { settleAt: { [Op.lte]: now } },
                // A call made before betting closed still needs its window checked
                { status: 'pending' },
            ],
        },
    });

    for (const market of due) {
        if (market.type === 'custom') {
            await sweepCustomMarket(client, market, now);
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
            status: { [Op.in]: ACTIVE_STATUSES },
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
    settleDueAt,
    customStatusLine,
    proposalPayload,
    proposeOutcome,
    setProposalMessage,
    respondToProposal,
    settleMarketNow,
    customMarketPayload,
    refreshMarketPost,
    getOpenBets,
    listOpenMarkets,
    marketSweepJob: {
        name: 'bet-market-sweep',
        run: sweepMarkets,
    },
};
