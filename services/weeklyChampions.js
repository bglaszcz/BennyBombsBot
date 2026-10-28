/**
 * Sunday-night weekly champions for Wordle and MapTap. Posts the podium and,
 * if a champion role is configured, moves it from last week's winner to this one.
 */
const { EmbedBuilder } = require('discord.js');
const { Op } = require('sequelize');
const { WordleScore, MapTapScore } = require('../models');
const settings = require('../config/settings');
const { getWordleNumber } = require('../utils/wordle');
const { getNickname } = require('../utils/getNickname');
const { getState, setState } = require('./botState');
const { localDateKey } = require('./scheduler');

const MIN_GAMES = 4;
const MEDALS = ['🥇', '🥈', '🥉'];

/** Monday 00:00 of the current week (weeks run Monday–Sunday) */
function getWeekStart(now = new Date()) {
    const start = new Date(now);
    const daysSinceMonday = (now.getDay() + 6) % 7;
    start.setDate(now.getDate() - daysSinceMonday);
    start.setHours(0, 0, 0, 0);
    return start;
}

/**
 * @param {Array} rows - Score rows with userId, username and a numeric field
 * @param {string} field - Column to average
 * @param {'asc'|'desc'} direction - 'asc' when lower is better
 */
function rankByAverage(rows, field, direction) {
    const byUser = new Map();
    for (const row of rows) {
        const entry = byUser.get(row.userId) || { userId: row.userId, username: row.username, total: 0, games: 0 };
        entry.total += row[field];
        entry.games++;
        byUser.set(row.userId, entry);
    }

    const sign = direction === 'asc' ? 1 : -1;
    return [...byUser.values()]
        .filter(e => e.games >= MIN_GAMES)
        .map(e => ({ ...e, avg: e.total / e.games }))
        .sort((a, b) => sign * (a.avg - b.avg) || b.games - a.games);
}

async function handOffRole(client, roleId, stateKey, winnerId) {
    const previousId = await getState(stateKey);
    await setState(stateKey, winnerId);
    if (!roleId || previousId === winnerId) return;

    try {
        const guild = await client.guilds.fetch(settings.guildId);
        if (previousId) {
            const previous = await guild.members.fetch(previousId).catch(() => null);
            await previous?.roles.remove(roleId);
        }
        const winner = await guild.members.fetch(winnerId);
        await winner.roles.add(roleId);
    }
    catch (error) {
        console.error(`Failed to move champion role ${roleId}:`, error.message);
    }
}

async function announce(client, { channelId, title, color, ranking, formatScore, roleId, stateKey }) {
    if (!channelId || ranking.length === 0) return;

    const podium = ranking.slice(0, 3).map((e, i) =>
        `${MEDALS[i]} **${getNickname(e.userId, e.username)}** — avg ${formatScore(e.avg)} over ${e.games} games`,
    ).join('\n');

    const champion = ranking[0];
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setDescription(`👑 All hail <@${champion.userId}>, champion of the week!\n\n${podium}`)
        .setFooter({ text: `Minimum ${MIN_GAMES} games to qualify` })
        .setTimestamp();

    const channel = await client.channels.fetch(channelId);
    await channel.send({ embeds: [embed] });
    await handOffRole(client, roleId, stateKey, champion.userId);
}

/** @param {Date} [now] - Any time on the final day of the week being scored */
async function crownWeeklyChampions(client, now = new Date()) {
    const weekStart = getWeekStart(now);

    const wordleRows = await WordleScore.findAll({
        where: { wordleNumber: { [Op.between]: [getWordleNumber(weekStart), getWordleNumber(now)] } },
        raw: true,
    });
    await announce(client, {
        channelId: settings.channels.wordle,
        title: '🟩 Wordle Champion of the Week',
        color: 0x538D4E,
        ranking: rankByAverage(wordleRows, 'score', 'asc'),
        formatScore: avg => avg.toFixed(2),
        roleId: settings.roles.wordleChampion,
        stateKey: 'champion:wordle',
    });

    const mapTapRows = await MapTapScore.findAll({
        where: { puzzleDate: { [Op.between]: [localDateKey(weekStart), localDateKey(now)] } },
        raw: true,
    });
    await announce(client, {
        channelId: settings.channels.maptap,
        title: '🗺️ MapTap Champion of the Week',
        color: 0x1ABC9C,
        ranking: rankByAverage(mapTapRows, 'finalScore', 'desc'),
        formatScore: avg => avg.toFixed(1),
        roleId: settings.roles.maptapChampion,
        stateKey: 'champion:maptap',
    });
}

module.exports = {
    crownWeeklyChampions,
    weeklyChampionsJob: {
        name: 'weekly-champions',
        hour: settings.schedule.championsHour,
        weekday: settings.schedule.championsWeekday,
        run: crownWeeklyChampions,
    },
};
