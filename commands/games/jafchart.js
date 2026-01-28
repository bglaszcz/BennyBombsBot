const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName(`jafchart`)
        .setDescription(`Show jaf fun chart`),
    execute(interaction) {

        const images = `./assets/images/jafchart/image1.png`;

        try {
            interaction.reply({ files: [images] });
        }
        catch (err) {
            interaction.reply("YOU BROKE IT!!!");
        }
    },
};