const path = require('node:path');
const { SlashCommandBuilder } = require('discord.js');

const IMAGE_DIR = path.join(__dirname, '..', '..', 'assets', 'images', 'supeson');
const IMAGES = ['Lson.png', 'covidson.png', '2019-04-27.gif'];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('supeson')
		.setDescription('Pick a random son gif from local files'),
	async execute(interaction) {
		const image = IMAGES[Math.floor(Math.random() * IMAGES.length)];
		await interaction.reply({ files: [path.join(IMAGE_DIR, image)] });
	},
};
