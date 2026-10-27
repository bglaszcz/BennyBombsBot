const { SlashCommandBuilder } = require('discord.js');
const Emojis = require('../../utils/emojis.js'); // Import the array of emojis

const { UniqueConstraintError } = require('sequelize');
const { GMCMessage } = require('../../models');
const { dayKey } = require('../../utils/dayKey');
const { getGmcSponsor } = require('../../services/shop');
const { getNickname } = require('../../utils/getNickname');

/**
 * Special dates configuration for GMC command
 *
 * Each entry can have:
 * - month: 1-12 (January = 1, December = 12)
 * - day: 1-31 (for fixed dates)
 * - weekday + nth: (for floating dates instead of 'day') weekday is 0-6 (Sun-Sat),
 *   nth is 1-4 for the 1st/2nd/3rd/4th occurrence in the month, or -1 for the last occurrence
 * - year: (optional) specific year, omit for recurring yearly
 * - message: (optional) custom text message to send instead of normal GMC
 * - emojis: (optional) array of emojis to use instead of random ones
 * - gmcOverride: (optional) replace 'GMC' text (e.g., 'GMF' for Good Morning Fisherman)
 * - prefixText: (optional) text to add before the GMC message
 * - suffixText: (optional) text to add after the GMC message
 *
 * If 'message' is set, it replaces the entire GMC output.
 * If 'emojis' is set, those emojis are used instead of random selection.
 * If 'gmcOverride' is set, it replaces the GMC letters in the middle.
 * 'prefixText' and 'suffixText' are added around the normal GMC format.
 */
const SPECIAL_DATES = [
  // Good Morning Fisherman!
  { month: 1, day: 16, year: 2026, emojis: ['🎣', '🐟', '🐠', '🐡'], gmcOverride: 'GMF' },

  // New Year's Day
  { month: 1, day: 1, emojis: ['🎉', '🥳', '✨'], prefixText: '🎉 Happy New Year! ', suffixText: ' 🎉' },

  // Martin Luther King Jr. Day - 3rd Monday of January
  { month: 1, weekday: 1, nth: 3, emojis: ['✊🏾', '🕊️', '📖'], prefixText: '🕊️ Honoring Dr. King today! ' },

  // Valentine's Day
  { month: 2, day: 14, emojis: ['❤️', '💘', '💕', '🌹'] },

  // Presidents Day - 3rd Monday of February
  { month: 2, weekday: 1, nth: 3, emojis: ['🇺🇸', '🎩', '🦅'] },

  // St. Patrick's Day
  { month: 3, day: 17, emojis: ['☘️', '🍀', '🌈'], prefixText: "☘️ Top o' the mornin'! " },

  // Memorial Day - last Monday of May
  { month: 5, weekday: 1, nth: -1, emojis: ['🇺🇸', '🎖️', '🌷'] },

  // Juneteenth
  { month: 6, day: 19, emojis: ['✊🏾', '🇺🇸', '🎉'] },

  // Independence Day
  { month: 7, day: 4, emojis: ['🎆', '🎇', '🇺🇸', '🧨'] },

  // Labor Day - 1st Monday of September
  { month: 9, weekday: 1, nth: 1, emojis: ['🛠️', '👷', '🇺🇸'] },

  // Columbus Day / Indigenous Peoples Day - 2nd Monday of October
  { month: 10, weekday: 1, nth: 2, emojis: ['🌎', '⛵'] },

  // Halloween with spooky emojis
  { month: 10, day: 31, emojis: ['🎃', '👻', '🦇', '🕷️', '💀'] },

  // Veterans Day
  { month: 11, day: 11, emojis: ['🇺🇸', '🎖️', '🫡'] },

  // Thanksgiving - 4th Thursday of November
  { month: 11, weekday: 4, nth: 4, emojis: ['🦃', '🍁', '🥧'], prefixText: '🦃 Happy Thanksgiving! ' },

  // Christmas Eve
  { month: 12, day: 24, emojis: ['🎄', '✨', '🕯️'] },

  // Christmas Day
  { month: 12, day: 25, emojis: ['🎄', '🎅', '🎁', '⛄'] },

  // New Year's Eve
  { month: 12, day: 31, emojis: ['🥂', '🎉', '✨'], suffixText: ' See you next year! 🎆' },
];

/**
 * Get the day-of-month for the nth occurrence of a weekday in a given month/year
 * @param {number} year
 * @param {number} month - 1-indexed (January = 1)
 * @param {number} weekday - 0-6 (Sunday = 0)
 * @param {number} nth - 1-4 for the nth occurrence, or -1 for the last occurrence
 * @returns {number|null} - Day of month, or null if not found
 */
function getNthWeekdayOfMonth(year, month, weekday, nth) {
  if (nth === -1) {
    const lastDayOfMonth = new Date(year, month, 0).getDate();
    for (let day = lastDayOfMonth; day >= 1; day--) {
      if (new Date(year, month - 1, day).getDay() === weekday) {
        return day;
      }
    }
    return null;
  }

  let occurrences = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month - 1, day).getDay() === weekday) {
      occurrences++;
      if (occurrences === nth) {
        return day;
      }
    }
  }
  return null;
}

/**
 * Check if today matches a special date
 * @param {Date} today - Current date
 * @returns {object|null} - Matching special date config or null
 */
function getSpecialDate(today) {
  const month = today.getMonth() + 1; // Convert to 1-indexed
  const day = today.getDate();
  const year = today.getFullYear();

  return SPECIAL_DATES.find(special => {
    const monthMatch = special.month === month;
    if (!monthMatch) return false;

    const yearMatch = special.year === undefined || special.year === year;
    if (!yearMatch) return false;

    if (special.weekday !== undefined && special.nth !== undefined) {
      const floatingDay = getNthWeekdayOfMonth(year, special.month, special.weekday, special.nth);
      return floatingDay === day;
    }

    return special.day === day;
  }) || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gmc')
    .setDescription('Wish the crew good morning!'),
  async execute(interaction) {
    const today = new Date();
    const todayString = dayKey(today);

    // Check for special date
    const specialDate = getSpecialDate(today);

    // If special date has a full message replacement, send it and return
    if (specialDate?.message) {
      return interaction.reply(specialDate.message);
    }

    // Regular GMC command logic (with possible special date modifications)
    try {
      const existingGMCMessage = await GMCMessage.findOne({
        where: { date: todayString },
      });

      if (existingGMCMessage) {
        const existingCreatedAt = existingGMCMessage.createdAt.toLocaleString();
        const replyContent = `The crew has already been wished good morning today at ${existingCreatedAt}.`;
        await interaction.reply(replyContent);
      } else {
        let selectedEmojis;
        // Someone may have bought today's emojis in the shop — that beats holidays too
        const sponsor = await getGmcSponsor(today);

        if (sponsor) {
          selectedEmojis = [...sponsor.emojis];
        } else if (specialDate?.emojis) {
          selectedEmojis = [...specialDate.emojis];
        } else {
          const emojis = Emojis; // Use the imported array of emojis
          const rando = Math.floor(Math.random() * 4) + 3;

          const emojiIndices = new Set();
          while (emojiIndices.size < rando) {
            emojiIndices.add(Math.floor(Math.random() * emojis.length));
          }

          selectedEmojis = [...emojiIndices].map(index => emojis[index]);
        }

        // Create a new GMCMessage in the database. The unique date column
        // settles two people running /gmc at the same moment.
        try {
          await GMCMessage.create({
            date: todayString,
            userId: interaction.user.id,
            username: interaction.user.username,
            emojis: selectedEmojis.join(''),
          });
        } catch (error) {
          if (!(error instanceof UniqueConstraintError)) throw error;
          return interaction.reply('Too slow! Someone just beat you to wishing the crew good morning. 🏃');
        }

        // Build the GMC message (or custom override like GMF)
        const gmcLetters = specialDate?.gmcOverride || 'GMC';
        const letterEmojis = gmcLetters
          .toLowerCase()
          .split('')
          .map(letter => `:regional_indicator_${letter}:`)
          .join('');

        const gmcCore =
          selectedEmojis.join('') +
          letterEmojis +
          [...selectedEmojis].reverse().join('');

        // Add prefix/suffix text if configured for special date
        const prefix = specialDate?.prefixText || '';
        const suffix = specialDate?.suffixText || '';
        const sponsorCredit = sponsor
          ? `
-# 🛒 Today's emojis sponsored by ${getNickname(sponsor.buyerId, 'a mystery donor')}`
          : '';
        const replyContent = prefix + gmcCore + suffix + sponsorCredit;

        // Send the reply back to the interaction
        await interaction.reply(replyContent);
      }
    } catch (error) {
      console.error(error);
      await interaction.reply('An error occurred while processing the command.');
    }
  },
};