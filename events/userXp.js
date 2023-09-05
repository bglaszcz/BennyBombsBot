const { DataTypes } = require('sequelize');
const dayjs = require('dayjs');
const { Events } = require('discord.js');

const sequelize = require('../db.js');
const User = require('../models/User.js')(sequelize, DataTypes);

const XP_PER_MESSAGE = 15;
const MIN_XP = 15;
const MAX_XP = 25;
const COOLDOWN = 60000;

const TARGET_GUILD_ID = '771095355077033994'; // Replace with your target guild ID

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || message.guild.id !== TARGET_GUILD_ID) return;

    try {
      const [user, created] = await User.findOrCreate({
        where: { userId: message.author.id },
        defaults: {
          userId: message.author.id,
          username: message.author.username,
          xp: 0,
          level: 1,
          lastMessageTime: 0,
        },
      });

      const currentTime = Date.now();

      if (user.lastMessageTime && currentTime - user.lastMessageTime < COOLDOWN) {
        return;
      }

      const earnedXP = Math.floor(Math.random() * (MAX_XP - MIN_XP + 1)) + MIN_XP;
      user.xp += earnedXP;
      user.lastMessageTime = currentTime;

      const levelThreshold = 100 * user.level * user.level;
      if (user.xp >= levelThreshold) {
        user.level += 1;
        user.xp = 0;
        const levelUpMessages = [
          `💎 Shine bright like a diamond! ${message.author.username} just got polished by Manager Lucas and sparkled up to level ${user.level}! ✨`,
          `🔧🔷 Lucas must be a master jeweler! ${message.author.username} just got upgraded to level ${user.level}, thanks to all that polishing! 💪`,
          `🏡 Giddy up! ${message.author.username} saddled up and rode to level ${user.level}! Who knew Lucas' ranch house was full of XP treasures? 🤠`,
          `🌄 Saddlebags packed, ${message.author.username} ventured to Lucas' ranch and found themselves at level ${user.level}! Yeehaw! 🌵`,
          `🍑 Bootylicious journey! ${message.author.username} just boosted their way to level ${user.level}! Nancy's spirit lives on in every step! 👣`,
          `🍑 Unstoppable! ${message.author.username} leveled up to ${user.level}, channeling the energy of Nancy's legendary enthusiasm! Let's keep that momentum rolling! 💃`,
          `🚀 ${message.author.username} just ascended to level ${user.level} with Carson's expert guidance! You're reaching new heights with every step! 🌟`,
          `🎩 Presto-chango! ${message.author.username} just leveled up to ${user.level}, thanks to some of Carson's magical supervisory skills! 🎩`,
          `🌟 With a nod from Supervisor Carson, ${message.author.username} rose to level ${user.level}! This teamwork is pure gold! 🏆`,
          `🌟 Blessings upon blessings! ${message.author.username} has been lifted to level ${user.level}, riding the wave of good fortune! 🌈✨`,
          `🎁 What a gift! ${message.author.username} is climbing to level ${user.level} with abundant blessings in their backpack! 🎂🎈`,
          `⭐ It's a celestial celebration! ${message.author.username} ascended to level ${user.level}, surrounded by the blessings of the universe! ⚡🌠`,
        ];
        const randomMessage = levelUpMessages[Math.floor(Math.random() * levelUpMessages.length)];
        message.channel.send(randomMessage);
      }

      await user.save();
      console.log(`${message.author.tag} earned ${earnedXP} XP.`);
    } catch (error) {
      console.error('Error processing message:', error);
    }
  },
};
