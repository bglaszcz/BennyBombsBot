const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName(`this`)
        .setDescription(`^^^^^^^^^^`),
    execute(interaction) {

            const gifUrl = `https://media.giphy.com/media/oxLpLI0eNf3Wg/giphy.gif`;

            const gifEmbed = {
                embeds: [{
                        image: {
                                url: gifUrl,
                        },
                }],
            };

            interaction.reply(gifEmbed);
        },
};
