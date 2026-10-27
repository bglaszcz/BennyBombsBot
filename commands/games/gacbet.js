const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { GACBet, GACMessage } = require('../../models');
const { CATEGORIES, CATEGORY_CHOICES, WIN_MULTIPLIER, placeBet } = require('../../services/gacBets');
const { dayKey } = require('../../utils/dayKey');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gacbet')
		.setDescription('Bet XP on what Lucas\'s excuse will be about today')
		.addStringOption(option => option
			.setName('category')
			.setDescription('What will the excuse involve?')
			.setRequired(true)
			.addChoices(...CATEGORY_CHOICES))
		.addIntegerOption(option => option
			.setName('wager')
			.setDescription('XP to wager (from your current level progress)')
			.setMinValue(5)
			.setMaxValue(1000)
			.setRequired(true)),

	async execute(interaction) {
		const category = interaction.options.getString('category');
		const wager = interaction.options.getInteger('wager');
		const date = dayKey();

		if (await GACMessage.findOne({ where: { date } })) {
			return interaction.reply({ content: 'Too late — Lucas already made his excuse today. Bets are closed. 🔒', flags: MessageFlags.Ephemeral });
		}

		const result = await placeBet(interaction.user, date, category, wager);
		if (result.error) {
			return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
		}

		const totalBets = await GACBet.count({ where: { date } });

		return interaction.reply(
			`🎲 ${interaction.user} ${result.changed ? 'changed their bet to' : 'bet'} **${wager} XP** that Lucas's excuse involves **${CATEGORIES[category]}**.\n` +
			`*Wager is held until settlement; a win returns it plus ${WIN_MULTIPLIER}x. ${totalBets} bet${totalBets !== 1 ? 's' : ''} on the table — settled when someone runs /gac.*`,
		);
	},
};
