const { Events } = require('discord.js');
const { User, LevelUpMessage } = require('../models');
const settings = require('../config/settings');
const { applyXp } = require('../utils/xp');

const { min: MIN_XP, max: MAX_XP, cooldownMs: COOLDOWN_MS } = settings.xp;
const { chatMin: MIN_COINS, chatMax: MAX_COINS, levelUpBonus: LEVEL_UP_COINS } = settings.economy;

// userId -> last time XP was awarded. Checked before touching the DB so
// messages inside the cooldown cost nothing. The DB's lastMessageTime still
// guards the first message after a restart.
const lastAwarded = new Map();

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || message.guild?.id !== settings.guildId) return;

    const currentTime = Date.now();
    if (currentTime - (lastAwarded.get(message.author.id) || 0) < COOLDOWN_MS) return;

    try {
      const [user] = await User.findOrCreate({
        where: { userId: message.author.id },
        defaults: {
          userId: message.author.id,
          username: message.author.username,
          xp: 0,
          level: 1,
          lastMessageTime: 0,
        },
      });

      if (user.lastMessageTime && currentTime - user.lastMessageTime < COOLDOWN_MS) {
        lastAwarded.set(message.author.id, Number(user.lastMessageTime));
        return;
      }
      lastAwarded.set(message.author.id, currentTime);

      // Award random XP between MIN_XP and MAX_XP
      const earnedXP = Math.floor(Math.random() * (MAX_XP - MIN_XP + 1)) + MIN_XP;
      user.lastMessageTime = currentTime;
      let earnedCoins = Math.floor(Math.random() * (MAX_COINS - MIN_COINS + 1)) + MIN_COINS;

      // Overflow past the threshold carries into the next level
      if (applyXp(user, earnedXP) > 0) {
        earnedCoins += LEVEL_UP_COINS;
        // Store the message that triggered the level-up
        await LevelUpMessage.create({
          userId: message.author.id,
          username: message.author.username,
          level: user.level,
          messageContent: message.content,
          messageId: message.id,
          channelId: message.channel.id,
          timestamp: message.createdTimestamp,
        });
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
        await message.channel.send(`${randomMessage}
-# +${LEVEL_UP_COINS} ${settings.economy.emoji} level-up bonus`);
        console.log(`${message.author.tag} reached level ${user.level}.`);
      }

      await user.save();
      // Atomic increment so this can't overwrite a bet or purchase happening at the same moment
      await user.increment('coins', { by: earnedCoins });
    } catch (error) {
      console.error('Error processing message:', error);
    }
  },
};
