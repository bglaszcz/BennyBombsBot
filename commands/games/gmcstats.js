const { SlashCommandBuilder } = require('discord.js');
const { GMCMessage, sequelize } = require('../../models');
const { getNicknameByUsername } = require('../../utils/getNickname');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gmcstats')
    .setDescription('Show GMC command statistics per user.'),
  async execute(interaction) {
    try {
      // Count per user plus their average time of day (America/Chicago) in one pass
      const userStats = await GMCMessage.findAll({
        attributes: [
          'username',
          [sequelize.fn('COUNT', sequelize.col('username')), 'triggerCount'],
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
        order: [[sequelize.literal('"triggerCount"'), 'DESC']],
        raw: true,
      });

      if (userStats.length === 0) {
        return interaction.reply('Nobody has wished the crew good morning yet. 😴');
      }

      const response = userStats
        .map(stats =>
          `**User:** ${getNicknameByUsername(stats.username)}\n` +
          `**Trigger Count:** ${stats.triggerCount}\n` +
          `**Average Time of Day:** ${stats.averageTimeOfDay ?? 'N/A'}`,
        )
        .join('\n\n');

      await interaction.reply(response.length > 2000 ? `${response.slice(0, 1997)}...` : response);
    }
    catch (error) {
      console.error(error);
      await interaction.reply('An error occurred while processing the command.');
    }
  },
};
