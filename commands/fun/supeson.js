const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('supeson')
		.setDescription('Pick a random son gif from local files'),
	async execute(interaction) {
		const filePaths = [
			'C:\\Users\\Server\\Documents\\BennyBombsBot\\assets\\images\\supeson\\Lson.png',
			'C:\\Users\\Server\\Documents\\BennyBombsBot\\assets\\images\\supeson\\covidson.png',
			'C:\\Users\\Server\\Documents\\BennyBombsBot\\assets\\images\\supeson\\2019-04-27.gif',
		];

		const randomIndex = Math.floor(Math.random() * filePaths.length);
		const selectedPath = filePaths[randomIndex];

		try {
			const fileStream = fs.createReadStream(selectedPath);
			await interaction.reply({ files: [fileStream] });
		} catch (err) {
			console.error(err);
			await interaction.reply('An error occurred!');
		}
	},
};
