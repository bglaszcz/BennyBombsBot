const { DataTypes } = require('sequelize');
// const dayjs = require('dayjs');
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
          `☕ Watch out! ${message.author.username} just shotgunned a coffee and skyrocketed to level ${user.level}! Lucas' special brew never misses! 🚀✨`,
          `🍑 Double cheeked up! ${message.author.username} just leveled up to ${user.level}, with a boost from Nancy's legendary badonkadonk! It's giving major gyatt energy! 🍑💥`,
          `🎒 Pack it up! ${message.author.username} just leveled up to ${user.level}, with Sus Shannon sneaking in some XP on the sly. Who knew that little side-eye came with benefits? 😏✨`,
          `💎 IYKYK, ${message.author.username} just hit level ${user.level} and is shining brighter than Lucas' forehead on a hot day! That's some serious bling, fam! 💎😎`,
          `🏇 Keep it giddy, fam! ${message.author.username} leveled up to ${user.level}, fueled by Sus Shannon’s spicy secrets and Lucas’ ranch shenanigans! 🤠🔥`,
          `☕ Coffee Toots strikes again! ${message.author.username} just zoomed up to level ${user.level}, fueled by the unholy combo of espresso and sheer willpower! 🚀💨`,
          `🍑 Nancy's badonkadonk magic strikes again! ${message.author.username} just bounced to level ${user.level}, leaving everyone in awe of that power move! 🥵💃`,
          `🛠️ Lucas might be built different, but ${message.author.username} just hit level ${user.level} with a little help from those… let’s call them “extra hands” 👀🔧`,
          `✨ Bless up, fam! ${message.author.username} just vibed their way to level ${user.level} with a sprinkle of Lucas’ luck and Nancy’s gyatt-worthy energy! 🌟🍑`,
          `🛠️ Lucas might be Mr. Fix-It, but ${message.author.username} just finessed their way to level ${user.level} with a little help from the squad. Blessings all around! 🔧✨`,
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
