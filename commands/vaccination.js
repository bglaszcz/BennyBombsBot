const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName(`vaccination`)
        .setDescription(`Vaccination? What is it good for?`),
    execute(interaction) {
        interaction.reply('= Depopulation!').then(function(sentMessage) {sentMessage.react(`<:this_tbh:870658997605253120>`);},
        );
    },
};