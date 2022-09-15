const fs = require('fs');
const imageFiles = fs.readdirSync('./images/supeson');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName(`supeson`)
        .setDescription(`Pick random son gif`),
    execute(interaction) {

        const images = new Array();
        let i = 0;
        for (const file of imageFiles) {
            images[i] = `./images/supeson/${file}`;
            i++;
        }
        const number = Math.floor(Math.random() * images.length);
        try {
            interaction.reply({ files: [images[number]] });
        }
        catch (err) {
            interaction.reply("YOU BROKE IT!!!");
        }
    },
};