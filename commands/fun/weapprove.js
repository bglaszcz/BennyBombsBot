const path = require('node:path');
const { SlashCommandBuilder } = require('discord.js');

const IMAGE = path.join(__dirname, '..', '..', 'assets', 'images', 'weapprove', 'image0.jpeg');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('weapprove')
        .setDescription('Your supes approve'),
    async execute(interaction) {
        await interaction.reply({ files: [IMAGE] });
    },
};
