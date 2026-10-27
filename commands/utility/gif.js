const { SlashCommandBuilder } = require('discord.js');
const { randomGif } = require('../../utils/giphy');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gif')
    .setDescription('Random Gif Picker')
    .addStringOption(option => option
      .setName('gif_search')
      .setDescription('The word or string to search for')
      .setRequired(true)),
  async execute(interaction) {
    const keywords = interaction.options.getString('gif_search');

    try {
      const gif = await randomGif(keywords, { limit: 10 });
      await interaction.reply(gif ? gif.url : `No GIFs were found for "${keywords}".`);
    }
    catch (err) {
      console.error(err);
      await interaction.reply('An error occurred while fetching GIFs.');
    }
  },
};
