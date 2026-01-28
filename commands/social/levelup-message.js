const { SlashCommandBuilder } = require('discord.js');
const { Sequelize } = require('sequelize');
const sequelize = require('../../db.js');
const LevelUpMessage = require('../../models/LevelUpMessage')(sequelize, Sequelize.DataTypes);
const { getNickname } = require('../../utils/getNickname');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelup-message')
    .setDescription('View the message(s) that triggered a user\'s level-up')
    .addUserOption(option =>
      option
        .setName('user')
        .setDescription('The user to check (defaults to yourself)')
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('level')
        .setDescription('Specific level to view (defaults to most recent)')
        .setRequired(false)
        .setMinValue(2)
    ),
  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const specificLevel = interaction.options.getInteger('level');

      const displayName = getNickname(targetUser.id, targetUser.username);

      // Query for specific level or most recent
      const whereClause = { userId: targetUser.id };
      if (specificLevel) {
        whereClause.level = specificLevel;
      }

      const levelUpRecord = await LevelUpMessage.findOne({
        where: whereClause,
        order: [['level', 'DESC']],
      });

      if (!levelUpRecord) {
        if (specificLevel) {
          await interaction.reply(`${displayName} doesn't have a recorded level-up message for level ${specificLevel}.`);
        } else {
          await interaction.reply(`${displayName} hasn't leveled up yet, or no messages were captured.`);
        }
        return;
      }

      const timestamp = `<t:${Math.floor(levelUpRecord.timestamp / 1000)}:R>`;
      const messageLink = levelUpRecord.messageId && levelUpRecord.channelId
        ? `https://discord.com/channels/${interaction.guildId}/${levelUpRecord.channelId}/${levelUpRecord.messageId}`
        : null;

      // Get total level-ups for this user
      const totalLevelUps = await LevelUpMessage.count({
        where: { userId: targetUser.id },
      });

      const embed = {
        color: 0x00ff00,
        title: `Level-Up Message for ${displayName}`,
        fields: [
          {
            name: 'Level Reached',
            value: `${levelUpRecord.level}`,
            inline: true,
          },
          {
            name: 'When',
            value: timestamp,
            inline: true,
          },
          {
            name: 'Total Level-Ups',
            value: `${totalLevelUps}`,
            inline: true,
          },
          {
            name: 'The Message',
            value: levelUpRecord.messageContent
              ? (levelUpRecord.messageContent.length > 1024
                ? levelUpRecord.messageContent.substring(0, 1021) + '...'
                : levelUpRecord.messageContent)
              : '*No message content*',
          },
        ],
        timestamp: new Date(),
      };

      if (messageLink) {
        embed.fields.push({
          name: 'Jump to Message',
          value: `[Click here](${messageLink})`,
        });
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error fetching level-up message:', error);
      await interaction.reply('An error occurred while fetching the level-up message.');
    }
  },
};
