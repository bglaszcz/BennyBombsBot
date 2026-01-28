const { SlashCommandBuilder } = require('discord.js');
const Emojis = require('../../utils/emojis.js'); // Import the array of emojis

const { Sequelize } = require('sequelize');
const sequelize = require('../../db.js');

const GMCMessage = require('../../models/GMCMessage')(sequelize, Sequelize.DataTypes);

/**
 * Special dates configuration for GMC command
 *
 * Each entry can have:
 * - month: 1-12 (January = 1, December = 12)
 * - day: 1-31
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

  // Example: Recurring yearly with custom emojis
  { month: 12, day: 25, emojis: ['🎄', '🎅', '🎁', '⛄'] },

  // Example: Recurring with prefix/suffix text
  { month: 1, day: 1, prefixText: '🎉 Happy New Year! ', suffixText: ' 🎉' },

  // Example: Halloween with spooky emojis
  { month: 10, day: 31, emojis: ['🎃', '👻', '🦇', '🕷️', '💀'] },
];

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
    const dayMatch = special.day === day;
    const yearMatch = special.year === undefined || special.year === year;
    return monthMatch && dayMatch && yearMatch;
  }) || null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gmc')
    .setDescription('Wish the crew good morning!'),
  async execute(interaction) {
    const today = new Date();
    const todayString = today.toLocaleDateString(); // For database comparison

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
        interaction.reply(replyContent);
      } else {
        let selectedEmojis;

        // Use special date emojis if configured, otherwise random selection
        if (specialDate?.emojis) {
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

        // Create a new GMCMessage in the database
        await GMCMessage.create({
          date: todayString,
          username: interaction.user.username, // Include the username in the record
          emojis: selectedEmojis.join(''),
        });

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
        const replyContent = prefix + gmcCore + suffix;

        // Send the reply back to the interaction
        interaction.reply(replyContent);
      }
    } catch (error) {
      console.error(error);
      interaction.reply('An error occurred while processing the command.');
    }
  },
};