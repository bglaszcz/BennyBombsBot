const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName(`weapprove`)
        .setDescription(`Your supes approve`),
    execute(interaction) {

        const images = `./assets/images/weapprove/image0.jpeg`;

        try {
            interaction.reply({ files: [images] });
        }
        catch (err) {
            interaction.reply("YOU BROKE IT!!!");
        }
    },
};