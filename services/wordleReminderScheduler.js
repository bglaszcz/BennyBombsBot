const { Op } = require('sequelize');
const { WordleReminderOptIn, WordleScore } = require('../models');
const { channels, schedule } = require('../config/settings');
const { getWordleNumber } = require('../utils/wordle');

async function sendWordleReminders(client) {
    const optedIn = await WordleReminderOptIn.findAll();
    if (optedIn.length === 0) return;

    const submittedToday = await WordleScore.findAll({
        where: {
            userId: { [Op.in]: optedIn.map(o => o.userId) },
            wordleNumber: getWordleNumber(),
        },
        attributes: ['userId'],
    });
    const submittedSet = new Set(submittedToday.map(s => s.userId));

    const missing = optedIn.filter(o => !submittedSet.has(o.userId));
    if (missing.length === 0) return;

    const channel = await client.channels.fetch(channels.wordle);
    if (!channel) return;

    const mentions = missing.map(o => `<@${o.userId}>`).join(' ');
    await channel.send(`⏰ ${mentions} — you haven't posted today's Wordle result yet. Don't break your streak!`);
}

module.exports = {
    wordleReminderJob: {
        name: 'wordle-reminder',
        hour: schedule.wordleReminderHour,
        run: sendWordleReminders,
    },
};
