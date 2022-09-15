const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`dallas`)
        .setDescription(`Well that's Dallas`),
    execute(interaction) {

            const url = `https://c.tenor.com/882g69bLwI0AAAAC/the-office-andy-bernard.gif`;
            interaction.reply(url);
        },
};
