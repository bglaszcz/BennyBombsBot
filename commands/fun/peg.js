const { SlashCommandBuilder } = require('discord.js');
module.exports = {
	data: new SlashCommandBuilder()
		.setName(`peg`)
		.setDescription(`Peg?`),
	execute(interaction) {
		const today = new Date().toLocaleString('en-us', { weekday: 'long' });
		if (today === 'Wednesday') {
			interaction.reply(`https://klipy.com/gifs/batpeg-batpeg-wednesday`);
		} else {
			interaction.reply(`How much Peg could Peg's peg peg if Peg's peg could peg Peg?`);
		}
	},
};
