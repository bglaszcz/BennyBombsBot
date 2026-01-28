const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('discord.js');
const { GIPHYApiKey } = require('../../config.json');

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

    const encodedKeywords = encodeURIComponent(keywords);
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHYApiKey}&q=${encodedKeywords}&limit=10&rating=r`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch GIFs from Giphy');
      }

      const json = await response.json();

      if (json.data.length === 0) {
        interaction.reply(`No GIFs were found for "${keywords}".`);
      } else {
        const index = Math.floor(Math.random() * json.data.length);
        interaction.reply(json.data[index].url);
      }
    } catch (err) {
      console.error(err);
      interaction.reply('An error occurred while fetching GIFs.');
    }
  },
};
