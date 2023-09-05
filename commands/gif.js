const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('discord.js');
const { tenorApiKey } = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`gif`)
    .setDescription(`Random Gif Picker`)
    .addStringOption(option => option
      .setName('gif_search')
      .setDescription('The word or string to search for')
      .setRequired(true)),
  async execute(interaction) {
    const keywords = interaction.options.getString('gif_search');

    const encodedKeywords = encodeURIComponent(keywords); // Use encodeURIComponent instead of encodeURI for query parameters
    const url = `https://g.tenor.com/v1/search?q=${encodedKeywords}&key=${tenorApiKey}&limit=7`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch GIFs from Tenor');
      }

      const json = await response.json();

      if (json.results.length === 0) {
        interaction.reply(`No GIFs were found for "${keywords}".`);
      } else {
        const index = Math.floor(Math.random() * json.results.length);
        interaction.reply(json.results[index].url);
      }
    } catch (err) {
      console.error(err);
      interaction.reply('An error occurred while fetching GIFs.');
    }
  },
};
