const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName(`days`)
    .setDescription(`Days between now and a future date.`)
    .addStringOption(option => option
      .setName('day')
      .setDescription('Select date to compare')
      .setRequired(true)),
  execute(interaction) {
    try {
      const futureDateString = interaction.options.getString('day');
      const futureDate = new Date(futureDateString);
      
      if (isNaN(futureDate)) {
        interaction.reply(`Invalid date format. Please provide a valid date in YYYY-MM-DD format.`);
        return;
      }

      if (futureDate <= new Date()) {
        interaction.reply(`The provided date is not a future date.`);
        return;
      }

      // Adjust the input date to the local time zone offset
      const localFutureDate = new Date(futureDate.getTime() + futureDate.getTimezoneOffset() * 60000);

      const diffTime = Math.abs(Date.now() - localFutureDate);
      const diffDays = Math.ceil(diffTime / (1000 * 3600 * 24));
      const options = { weekday: `long`, year: `numeric`, month: `long`, day: `numeric` };
      const dateFormat = localFutureDate.toLocaleString('en-us', options);

      interaction.reply(`${diffDays} days until ${dateFormat}`);
    } catch (error) {
      console.error(error);
      interaction.reply(`An error occurred while processing the command.`);
    }
  },
};
