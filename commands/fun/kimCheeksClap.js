const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setName('kim')
        .setDescription('You what it is'),
    execute(interaction) {
            interaction.reply(`Dem cheeks CLAP CLAP CLAP`);

            const url = `https://media.giphy.com/media/rhq4biotLkkRG/giphy.gif`;
            interaction.channel.send(url);
        },
};
