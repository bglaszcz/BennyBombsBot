const path = require('node:path');
const { SlashCommandBuilder } = require('discord.js');

const IMAGE = path.join(__dirname, '..', '..', 'assets', 'images', 'jafchart', 'image1.png');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('jafchart')
        .setDescription('Show jaf fun chart'),
    async execute(interaction) {
        await interaction.reply({ files: [IMAGE] });
    },
};
