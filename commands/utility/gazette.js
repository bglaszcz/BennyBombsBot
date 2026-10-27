const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { buildGazette } = require('../../services/gazette');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gazette')
		.setDescription('Preview the Morning Gazette (Manage Server)')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
	async execute(interaction) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		await interaction.editReply({ embeds: [await buildGazette()] });
	},
};
