const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`gmcorbust`)
        .setDescription(`We finna bust`),
    execute(interaction) {

        interaction.reply(`https://www.youtube.com/watch?reload=9&v=0tdyU_gW6WE`);

    },
};