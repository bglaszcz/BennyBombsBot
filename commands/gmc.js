const { SlashCommandBuilder } = require('discord.js');
const Emojis = require('../bootjaf/emojis.js'); // Import the array of emojis

const { Sequelize } = require('sequelize');
const sequelize = require('../db.js');

const GMCMessage = require('../models/GMCMessage')(sequelize, Sequelize.DataTypes);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gmc')
    .setDescription('Wish the crew good morning!'),
  async execute(interaction) {
    const today = new Date().toLocaleString('en-us', { weekday: 'long' });

    try {
      const existingGMCMessage = await GMCMessage.findOne({
        where: { date: today },
      });

      if (existingGMCMessage) {
        interaction.reply('The crew has been wished good morning already.');
      } else {
        const emojis = Emojis; // Use the imported array of emojis
        const rando = Math.floor(Math.random() * 4) + 3;

        const emojiIndices = new Set();
        while (emojiIndices.size < rando) {
          emojiIndices.add(Math.floor(Math.random() * emojis.length));
        }

        const selectedEmojis = [...emojiIndices].map(index => emojis[index]);

        // Create a new GMCMessage in the database
        await GMCMessage.create({
          date: today,
          emojis: selectedEmojis.join(''),
        });

        const replyContent =
          selectedEmojis.join('') +
          ':regional_indicator_g::regional_indicator_m::regional_indicator_c:' +
          selectedEmojis.reverse().join('');

        // Send the reply back to the interaction
        interaction.reply(replyContent);
      }
    } catch (error) {
      console.error(error);
      interaction.reply('An error occurred while processing the command.');
    }
  },
};
