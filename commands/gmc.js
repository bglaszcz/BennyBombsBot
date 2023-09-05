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
    const today = new Date().toLocaleDateString(); // Get the current date in 'YYYY-MM-DD' format

    try {
      const existingGMCMessage = await GMCMessage.findOne({
        where: { date: today }, // Compare both date and username
      });

      if (existingGMCMessage) {
        const existingCreatedAt = existingGMCMessage.createdAt.toLocaleString();
        const replyContent = `The crew has already been wished good morning today at ${existingCreatedAt}.`;
        interaction.reply(replyContent);
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
          username: interaction.user.username, // Include the username in the record
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
