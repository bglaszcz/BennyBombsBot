const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const { channels, schedule } = require('../../config/settings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wordlereminder')
        .setDescription('Opt in or out of a 9pm ping if you haven\'t posted your Wordle result')
        .addStringOption(option =>
            option.setName('status')
                .setDescription('Turn reminders on or off')
                .setRequired(true)
                .addChoices(
                    { name: 'On - remind me if I forget', value: 'on' },
                    { name: 'Off - stop reminding me', value: 'off' },
                )),
    async execute(interaction) {
        const status = interaction.options.getString('status');
        const WordleReminderOptIn = interaction.client.models.WordleReminderOptIn;

        try {
            if (status === 'on') {
                await WordleReminderOptIn.upsert({
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });
                await interaction.reply({
                    content: `✅ You're opted in! If you haven't posted your Wordle result by ${schedule.wordleReminderHour % 12 || 12}${schedule.wordleReminderHour < 12 ? 'am' : 'pm'}, I'll ping you in <#${channels.wordle}>.`,
                    flags: MessageFlags.Ephemeral,
                });
            } else {
                await WordleReminderOptIn.destroy({ where: { userId: interaction.user.id } });
                await interaction.reply({
                    content: '🔕 You\'ve been opted out of Wordle reminders.',
                    flags: MessageFlags.Ephemeral,
                });
            }
        } catch (error) {
            console.error('Error updating Wordle reminder opt-in:', error);
            await interaction.reply({
                content: 'An error occurred while updating your reminder preference.',
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
