const { Sequelize, DataTypes } = require('sequelize');
const dayjs = require('dayjs');
const { Events } = require('discord.js');

const sequelize = require('../db.js');
const DethToot = require('../models/DethToot.js')(sequelize, Sequelize.DataTypes);

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    if (
      message.content.toLowerCase().includes('deth toot')
    ) {
      try {
        const dethTootEntry = await DethToot.findOne({
          where: { username: message.author.username },
          order: [['lastTootDate', 'DESC']],
        });

        const now = dayjs();
        const lastTootDate = dethTootEntry ? dayjs(dethTootEntry.lastTootDate) : dayjs(0);

        const durationInMilliseconds = now.diff(lastTootDate);
        const days = durationInMilliseconds / (1000 * 60 * 60 * 24); // Convert milliseconds to days

        let responseMessage = `${message.author} last had deth toots on ${lastTootDate.toLocaleString()}.`;

        if (days < 1) {
          const hours = durationInMilliseconds / (1000 * 60 * 60);
          const minutes = durationInMilliseconds / (1000 * 60);
          const seconds = durationInMilliseconds / 1000;
          responseMessage += ` ${hours.toFixed(1)} hours, ${minutes.toFixed(1)} minutes, and ${seconds.toFixed(1)} seconds since ${message.author} last had deth toots`;
        } else {
          responseMessage += ` ${days.toFixed(1)} days since ${message.author} last had deth toots`;
        }

        if (dethTootEntry) {
          await dethTootEntry.update({
            lastTootDate: now.toDate(),
          });
        } else {
          await DethToot.create({
            username: message.author.username,
            lastTootDate: now.toDate(),
          });
        }

        message.channel.send(responseMessage);
      } catch (error) {
        console.error(error);
      }
    }
  },
};