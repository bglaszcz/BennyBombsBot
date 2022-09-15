const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('discord.js');


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

    const testing = encodeURI(keywords);
    const url = `https://g.tenor.com/v1/search?q=${testing}&key=VB2LPT9PUU0Z&limit=7`;

    const response = await fetch(url);

    const json = await response.json();

    const index = Math.floor(Math.random() * json.results.length);

    try {
      interaction.reply(json.results[index].url);
    }
    catch (err) {
      interaction.reply(`Yo, a gif for ${keywords} wasn't found.`);
    }
  },
};