const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const OpenAI = require('openai'); // Use the correct constructor
const { chatGptKey } = require('../config.json');
const Sequelize = require('sequelize');
const sequelize = require('../db.js');

const OpenAIAPIUsage = require('../models/OpenAIAPIUsage')(sequelize, Sequelize.DataTypes);

const openai = new OpenAI({
  apiKey: chatGptKey,
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('image')
    .setDescription('Generate an image from a prompt')
    .addStringOption(option => option
      .setName('prompt')
      .setDescription('The prompt for generating the image')
      .setRequired(true)),
  async execute(interaction) {
    if (!interaction.isCommand()) return; // Ignore non-command interactions

    const userPrompt = interaction.options.getString('prompt');

    try {
      await OpenAIAPIUsage.create({
          username: interaction.user.username,
          prompt: userPrompt,
          type: 'image',
      });
    }
    catch (error) {
        console.log(error);
    }

    // Acknowledge the interaction
    await interaction.deferReply();

    try {
      const response = await openai.images.generate({ prompt: userPrompt });

      // Check if 'data' exists and is an array
      if (response.data && Array.isArray(response.data)) {
        // Extract image URLs from the 'data' array
        const imageUrls = response.data.map(item => item.url);
        const imageUrl = imageUrls[0]; // Assuming you want the first image URL

        // Create a MessageEmbed to embed the image
        const embed = new EmbedBuilder()
          .setImage(imageUrl); // Set the image URL as the image in the embed

        // Respond with the embedded image
        await interaction.editReply({ embeds: [embed] });
      } else {
        // If the OpenAI API response is null, send a generic error message
        await interaction.followUp('Failed to generate an image.');
      }
    } catch (error) {
      // If there's an error, send the specific OpenAI API error message if available,
      // otherwise send a generic error message
      const errorMessage = 'OpenAI API Error: ' + (error.response?.data || error.message);
      await interaction.followUp(errorMessage || 'An error occurred while processing your request.');
    }
  },
};
