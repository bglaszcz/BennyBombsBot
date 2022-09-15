const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('mel')
        .setDescription('Mella Yellin'),
    async execute(interaction) {

        const url = `https://api.tenor.com/v1/search?q=yell&key=VB2LPT9PUU0Z`;
        const response = await fetch(url);
        const json = await response.json();

        const index = Math.floor(Math.random() * json.results.length);

        interaction.reply(json.results[index].url);
    },
};