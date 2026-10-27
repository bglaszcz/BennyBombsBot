const { Events } = require('discord.js');
const { DethToot, DethTootLog } = require('../models');
const { formatDuration } = require('../utils/formatDuration');

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (!message.content.toLowerCase().includes('deth toot')) return;

    try {
      // DethToot keeps one "latest" row per username; DethTootLog records every toot
      const dethTootEntry = await DethToot.findOne({
        where: { username: message.author.username },
        order: [['lastTootDate', 'DESC']],
      });

      const now = new Date();
      let responseMessage;

      if (dethTootEntry) {
        const last = new Date(dethTootEntry.lastTootDate);
        const unix = Math.floor(last.getTime() / 1000);
        responseMessage = `${message.author} last had deth toots <t:${unix}:f>. ` +
          `That's **${formatDuration(now - last)}** of peace, now shattered. 💨`;
        await dethTootEntry.update({ lastTootDate: now });
      }
      else {
        responseMessage = `${message.author} has logged their first ever deth toot. The clock starts now. ⏱️💨`;
        await DethToot.create({ username: message.author.username, lastTootDate: now });
      }

      await DethTootLog.create({
        userId: message.author.id,
        username: message.author.username,
        tootedAt: now,
      });

      await message.channel.send(responseMessage);
    }
    catch (error) {
      console.error('Error handling deth toot:', error);
    }
  },
};
