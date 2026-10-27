const { SlashCommandBuilder } = require('discord.js');
const { randomGif } = require('../../utils/giphy');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('mel')
        .setDescription('Mella Yellin'),
    async execute(interaction) {
        const gif = await randomGif('yell');
        await interaction.reply(gif ? gif.url : 'Mel is too hoarse to yell right now. 🗣️');
    },
};
