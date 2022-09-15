const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName(`ryn`)
        .setDescription(`Ryn gif`),
    execute(interaction) {
            const url = `https://c.tenor.com/A-NINAUpA2gAAAAC/the-office-michael-scott.gif`;
            interaction.reply(url);
        },
};