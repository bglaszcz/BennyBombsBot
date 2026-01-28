const { SlashCommandBuilder } = require('discord.js');

module.exports = {
        data: new SlashCommandBuilder()
                .setName(`peg`)
                .setDescription(`Peg?`),
        execute(interaction) {
                interaction.reply(`How much Peg could Peg's peg peg if Peg's peg could peg Peg?`);

        },
};