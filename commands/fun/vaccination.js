const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName(`vaccination`)
        .setDescription(`Vaccination? What is it good for?`),
    async execute(interaction) {

        interaction.reply('= Depopulation!');
        const message = await interaction.fetchReply();
        message.react(`<:this_tbh:870658997605253120>`);

    },
};