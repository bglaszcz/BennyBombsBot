const { SlashCommandBuilder } = require('discord.js');
const { Sequelize } = require('sequelize');
const sequelize = require('../db.js');
const User = require('../models/User')(sequelize, Sequelize.DataTypes);
const { getNickname } = require('../utils/getNickname');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Generate a leaderboard of top 15 users by XP and level'),
  async execute(interaction) {
    try {
      const leaderboard = await User.findAll({
        order: [['level', 'DESC'], ['xp', 'DESC']],
        limit: 15,
      });

      const leaderboardRows = leaderboard.map((user, index) => {
        const displayName = getNickname(user.userId, user.username);
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        return `${medal} **${displayName}** (Level ${user.level}) - XP: ${user.xp}`;
      });

      const leaderboardEmbed = {
        color: 0x0099ff,
        title: '🏆 XP Leaderboard',
        description: leaderboardRows.join('\n'),
        footer: { text: 'Keep chatting to climb the ranks!' },
        timestamp: new Date(),
      };

      await interaction.reply({ embeds: [leaderboardEmbed] });
    } catch (error) {
      console.error('Error generating leaderboard:', error);
      await interaction.reply('An error occurred while generating the leaderboard.');
    }
  },
};