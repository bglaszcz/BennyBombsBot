const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName(`this`)
        .setDescription(`^^^^^^^^^^`),
    execute(interaction) {


            const url = `https://media.giphy.com/media/oxLpLI0eNf3Wg/giphy.gif`;
            interaction.reply(url);
        },
};
