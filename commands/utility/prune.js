const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('prune')
		.setDescription('Prune up to 99 messages.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addIntegerOption(option => option
			.setName('amount')
			.setDescription('Number of messages to prune')
			.setMinValue(1)
			.setMaxValue(99)
			.setRequired(true)),
	async execute(interaction) {
		const amount = interaction.options.getInteger('amount');

		await interaction.deferReply({ flags: MessageFlags.Ephemeral });

		try {
			// `true` skips messages older than 14 days, which Discord can't bulk delete
			const deleted = await interaction.channel.bulkDelete(amount, true);
			return interaction.editReply(`Successfully pruned \`${deleted.size}\` messages.`);
		}
		catch (error) {
			console.error(error);
			return interaction.editReply('There was an error trying to prune messages in this channel!');
		}
	},
};
