const fetch = require('node-fetch');
const { SlashCommandBuilder } = require('discord.js');
const { tenorApiKey } = require('../../config.json');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('idk')
        .setDescription('I dont know what that means'),
    async execute(interaction) {

        const gifurl = `https://tenor.com/view/i-dont-know-what-that-means-i-have-no-clue-what-youre-talking-about-clueless-huh-what-gif-17107312`;

        interaction.reply(gifurl);
    },
};