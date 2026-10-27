/**
 * Morning Gazette: a daily recap of yesterday's games and goings-on, plus an
 * out-of-context quote from this day in a previous year.
 */
const { EmbedBuilder } = require('discord.js');
const { Op, fn, col, where } = require('sequelize');
const { WordleScore, MapTapScore, GMCMessage, GACMessage, OutOfContext, sequelize } = require('../models');
const { channels, schedule } = require('../config/settings');
const { getWordleNumber } = require('../utils/wordle');
const { getNickname, getNicknameByUsername } = require('../utils/getNickname');
const { localDateKey } = require('./scheduler');

function namesList(rows) {
    return rows.map(r => `**${getNickname(r.userId, r.username)}**`).join(', ');
}

async function wordleSection(yesterday) {
    const wordleNumber = getWordleNumber(yesterday);
    const scores = await WordleScore.findAll({ where: { wordleNumber } });
    if (scores.length === 0) return null;

    const best = Math.min(...scores.map(s => s.score));
    const winners = scores.filter(s => s.score === best);
    const fails = scores.filter(s => s.score === 7);
    const bestLabel = best === 7 ? 'X' : best;

    let text = `#${wordleNumber}: ${namesList(winners)} led with **${bestLabel}/6** (${scores.length} played)`;
    if (fails.length > 0 && best !== 7) text += `\n💀 Took the L: ${namesList(fails)}`;
    return text;
}

async function mapTapSection(yesterday) {
    const scores = await MapTapScore.findAll({ where: { puzzleDate: localDateKey(yesterday) } });
    if (scores.length === 0) return null;

    const best = Math.max(...scores.map(s => s.finalScore));
    const winners = scores.filter(s => s.finalScore === best);
    return `${namesList(winners)} topped the map with **${best}** (${scores.length} played)`;
}

async function gmcSection(yesterday) {
    const gmc = await GMCMessage.findOne({ where: { date: yesterday.toLocaleDateString() } });
    if (!gmc) return '😴 Nobody wished the crew good morning. Shameful.';
    const unix = Math.floor(gmc.createdAt.getTime() / 1000);
    return `${gmc.emojis} — **${getNicknameByUsername(gmc.username)}** at <t:${unix}:t>`;
}

async function gacSection(yesterday) {
    const gac = await GACMessage.findOne({ where: { date: yesterday.toLocaleDateString() } });
    if (!gac) return null;
    const excuse = gac.excuse.length > 300 ? `${gac.excuse.slice(0, 297)}...` : gac.excuse;
    return `*"${excuse}"*`;
}

async function quoteSection(today) {
    const onThisDay = await OutOfContext.findOne({
        where: {
            [Op.and]: [
                where(fn('date_part', 'month', col('createdAt')), today.getMonth() + 1),
                where(fn('date_part', 'day', col('createdAt')), today.getDate()),
                where(fn('date_part', 'year', col('createdAt')), { [Op.lt]: today.getFullYear() }),
            ],
        },
        order: sequelize.random(),
    });

    const quote = onThisDay || await OutOfContext.findOne({ order: sequelize.random() });
    if (!quote) return null;

    const heading = onThisDay ? `📅 On this day in ${quote.createdAt.getFullYear()}` : '🎲 Random out-of-context';
    return { heading, text: `"${quote.quote}"\n— <@${quote.quotedUserId}>` };
}

async function buildGazette(today = new Date()) {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const [wordle, maptap, gmc, gac, quote] = await Promise.all([
        wordleSection(yesterday),
        mapTapSection(yesterday),
        gmcSection(yesterday),
        gacSection(yesterday),
        quoteSection(today),
    ]);

    const embed = new EmbedBuilder()
        .setColor(0xF5DEB3)
        .setTitle(`🗞️ The Morning Gazette — ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`)
        .setDescription('All the news that\'s fit to ping. Here\'s what went down yesterday:')
        .setTimestamp();

    embed.addFields({ name: '☀️ GMC', value: gmc });
    if (wordle) embed.addFields({ name: '🟩 Wordle', value: wordle });
    if (maptap) embed.addFields({ name: '🗺️ MapTap', value: maptap });
    if (gac) embed.addFields({ name: '🏃 Lucas\'s Excuse', value: gac });
    if (quote) embed.addFields({ name: quote.heading, value: quote.text });

    return embed;
}

async function postGazette(client) {
    if (!channels.gazette) return;
    const channel = await client.channels.fetch(channels.gazette);
    await channel.send({ embeds: [await buildGazette()] });
}

module.exports = {
    buildGazette,
    gazetteJob: {
        name: 'morning-gazette',
        hour: schedule.gazetteHour,
        run: postGazette,
    },
};
