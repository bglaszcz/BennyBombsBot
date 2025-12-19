const { SlashCommandBuilder } = require('discord.js');
const { Sequelize } = require('sequelize');
const sequelize = require('../db.js');
const User = require('../models/User')(sequelize, Sequelize.DataTypes);
const fs = require('fs');
const path = require('path');

// Helper to get nickname from userMemories by either username or userId
function getNickname(username, odrive) {
  try {
    const memoriesPath = path.join(__dirname, '..', 'userMemories.json');
    if (fs.existsSync(memoriesPath)) {
      const memories = JSON.parse(fs.readFileSync(memoriesPath, 'utf8'));
      // Find user by username and return nickname if exists
      for (const odrive in memories) {
        if (memories[odrive].username === username && memories[odrive].nickname) {
          return memories[odrive].nickname;
        }
      }
    }
  } catch (err) {
    console.error('Error loading nicknames:', err);
  }
  return username;
}

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
        const displayName = getNickname(user.username, user.userId);
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