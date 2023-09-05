const { SlashCommandBuilder } = require('discord.js');
const { Sequelize, Op } = require('sequelize');
const sequelize = require('../db.js');
const User = require('../models/User')(sequelize, Sequelize.DataTypes);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Generate a leaderboard of top 15 users by XP and level'),
  async execute(interaction) {
    try {
      const leaderboard = await User.findAll({
        order: [['level', 'DESC'], ['xp', 'DESC']], // Order by level DESC, then by xp DESC
        limit: 15,
      });

      const leaderboardRows = leaderboard.map((user, index) => {
        return `${index + 1}. **${user.username}** (Level ${user.level}) - XP: ${user.xp}`;
      });

      const leaderboardEmbed = {
        color: 0x0099ff,
        title: 'XP Leaderboard',
        description: leaderboardRows.join('\n'),
      };

      await interaction.reply({ embeds: [leaderboardEmbed] });
    } catch (error) {
      console.error('Error generating leaderboard:', error);
      await interaction.reply('An error occurred while generating the leaderboard.');
    }
  },
};
