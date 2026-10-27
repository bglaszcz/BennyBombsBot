const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { GACBet, GACMessage, User } = require('../../models');
const { CATEGORIES, CATEGORY_CHOICES, WIN_MULTIPLIER } = require('../../services/gacBets');

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
		const date = new Date().toLocaleDateString();

		if (await GACMessage.findOne({ where: { date } })) {
			return interaction.reply({ content: 'Too late — Lucas already made his excuse today. Bets are closed. 🔒', flags: MessageFlags.Ephemeral });
		}

		const user = await User.findByPk(interaction.user.id);
		const available = user?.xp ?? 0;
		if (wager > available) {
			return interaction.reply({
				content: `You only have **${available} XP** toward your next level to bet with. Go chat some more. 💬`,
				flags: MessageFlags.Ephemeral,
			});
		}

		const existing = await GACBet.findOne({ where: { date, userId: interaction.user.id } });
		if (existing) {
			await existing.update({ category, wager });
		}
		else {
			await GACBet.create({ date, userId: interaction.user.id, username: interaction.user.username, category, wager });
		}

		const totalBets = await GACBet.count({ where: { date } });

		return interaction.reply(
			`🎲 ${interaction.user} ${existing ? 'changed their bet to' : 'bet'} **${wager} XP** that Lucas's excuse involves **${CATEGORIES[category]}**.\n` +
			`*Win pays ${WIN_MULTIPLIER}x. ${totalBets} bet${totalBets !== 1 ? 's' : ''} on the table — settled when someone runs /gac.*`,
		);
	},
};
