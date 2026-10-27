const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { awardPickerPayload } = require('../../services/nominations');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Nominate for Award')
		.setType(ApplicationCommandType.Message),

	// Picking the award is handled by the "nominate-award" component in /nominate
	async execute(interaction) {
		const message = interaction.targetMessage;
		await interaction.reply(awardPickerPayload(message.channelId, message.id));
	},
};
