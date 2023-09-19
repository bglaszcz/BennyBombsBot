const { SlashCommandBuilder } = require('discord.js');
const { Sequelize } = require('sequelize');
const sequelize = require('../db.js');
const GMCMessage = require('../models/GMCMessage.js')(sequelize, Sequelize.DataTypes);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gmcstats')
    .setDescription('Show GMC command statistics per user.'),
  async execute(interaction) {
    try {
      // Count the number of times each user has triggered the /gmc command and order by trigger count
      const userTriggerCounts = await GMCMessage.findAll({
        attributes: ['username', [sequelize.fn('COUNT', sequelize.col('username')), 'triggerCount']],
        group: ['username'],
        order: [[sequelize.col('triggerCount'), 'DESC']],
      });

      // Calculate the average time of day in the America/Chicago timezone using a subquery
      const userTimestamps = await GMCMessage.findAll({
        attributes: [
          'username',
          [
            sequelize.literal(`
              TO_CHAR(
                TIME '00:00:00' +
                INTERVAL '1 minute' * AVG(EXTRACT(MINUTE FROM "createdAt" AT TIME ZONE 'America/Chicago')) +
                INTERVAL '1 hour' * AVG(EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'America/Chicago')),
                'HH12:MI AM'
              )
            `),
            'averageTimeOfDay',
          ],
        ],
        group: ['username'],
      });

      // Combine the results to generate per-user statistics
      const userStatistics = userTriggerCounts.map((userCount) => {
        const userTime = userTimestamps.find((time) => time.username === userCount.username);
        return {
          username: userCount.username,
          triggerCount: userCount.dataValues.triggerCount,
          averageTimeOfDay: userTime ? userTime.dataValues.averageTimeOfDay : 'N/A',
        };
      });

      // Create a formatted response message
      const response = userStatistics
        .map((statistics) => {
          return `**User:** ${statistics.username}\n` +
            `**Trigger Count:** ${statistics.triggerCount}\n` +
            `**Average Time of Day:** ${statistics.averageTimeOfDay !== null ? statistics.averageTimeOfDay : 'N/A'}`;
        })
        .join('\n\n');

      // Send the response to the interaction
      interaction.reply(response);
    } catch (error) {
      console.error(error);
      interaction.reply('An error occurred while processing the command.');
    }
  },
};
