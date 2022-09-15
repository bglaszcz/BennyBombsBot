const options = { weekday: `long`, year:`numeric`, month:`long`, day:`numeric` };
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName(`days`)
        .setDescription(`Days between now and a future date.`)
        .addStringOption(option => option.setName('day')
                                        .setDescription('Select date to compare')
                                        .setRequired(true)),
    execute(interaction) {

        const endDate = new Date(interaction.options.getString('day'));

        const diffTime = Math.abs(Date.now() - endDate);
        const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
        // let today = new Date().toLocaleString('en-us', {weekday: 'long'});
        const dateFormat = new Date(endDate).toLocaleString('en-us', options);

        interaction.reply(`${diffDays} days until ${dateFormat}`);
    },
};