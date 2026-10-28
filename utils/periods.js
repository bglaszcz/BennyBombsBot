// Shared time-period filter used by the Wordle and MapTap stats/leaderboards
const { Op } = require('sequelize');

const PERIOD_CHOICES = [
    { name: 'All Time', value: 'all' },
    { name: 'This Year', value: 'year' },
    { name: 'This Month', value: 'month' },
    { name: 'This Week', value: 'week' },
];

const PERIOD_LABELS = Object.fromEntries(PERIOD_CHOICES.map(c => [c.value, c.name]));

/**
 * @param {string} period - all | year | month | week
 * @param {Date} [now]
 * @returns {Date|null} Start of the period (local time), or null for all-time
 */
function getPeriodStart(period, now = new Date()) {
    if (period === 'year') return new Date(now.getFullYear(), 0, 1);
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1);
    if (period === 'week') {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        start.setHours(0, 0, 0, 0);
        return start;
    }
    return null;
}

/** Sequelize `where` fragment filtering postedAt to the period */
function getPeriodFilter(period, now = new Date()) {
    const start = getPeriodStart(period, now);
    return start ? { postedAt: { [Op.gte]: start } } : {};
}

/** Adds the standard optional `period` option to a SlashCommandBuilder */
function addPeriodOption(builder, description = 'Filter to a specific time period') {
    return builder.addStringOption(option =>
        option.setName('period')
            .setDescription(description)
            .setRequired(false)
            .addChoices(...PERIOD_CHOICES));
}

module.exports = { PERIOD_CHOICES, PERIOD_LABELS, getPeriodStart, getPeriodFilter, addPeriodOption };
