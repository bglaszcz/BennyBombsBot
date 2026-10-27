const { ContextMenuCommandBuilder, ApplicationCommandType, MessageFlags } = require('discord.js');
const { addQuote, selfDestruct } = require('../../services/outOfContext');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Add to Out of Context')
		.setType(ApplicationCommandType.Message),

	async execute(interaction) {
		const result = await addQuote(interaction.targetMessage, interaction.user);
		if (result.error) {
			return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
		}

		const response = await interaction.reply({ embeds: [result.embed], withResponse: true });
		selfDestruct(response.resource.message);
	},
};
