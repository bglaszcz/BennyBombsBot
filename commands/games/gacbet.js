const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { GACMessage, Bet } = require('../../models');
const { CATEGORIES, CATEGORY_CHOICES, openGacMarket } = require('../../services/gacBets');
const { placeBet } = require('../../services/bets');
const { formatCoins } = require('../../services/economy');
const { betting } = require('../../config/settings');
const { dayKey } = require('../../utils/dayKey');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('gacbet')
		.setDescription('Bet Bomb Bucks on what Lucas\'s excuse will be about today')
		.addStringOption(option => option
			.setName('category')
			.setDescription('What will the excuse involve?')
			.setRequired(true)
			.addChoices(...CATEGORY_CHOICES))
		.addIntegerOption(option => option
			.setName('wager')
			.setDescription('Bomb Bucks to wager')
			.setMinValue(betting.minWager)
			.setMaxValue(betting.maxWager)
			.setRequired(true)),

	async execute(interaction) {
		const category = interaction.options.getString('category');
		const wager = interaction.options.getInteger('wager');
		const date = dayKey();

		if (await GACMessage.findOne({ where: { date } })) {
			return interaction.reply({ content: 'Too late — Lucas already made his excuse today. Bets are closed. 🔒', flags: MessageFlags.Ephemeral });
		}

		const market = await openGacMarket(date, interaction.channelId);
		const result = await placeBet(market, interaction.user, category, wager);
		if (result.error) {
			return interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
		}

		const totalBets = await Bet.count({ where: { marketId: market.id } });
		const multiplier = market.options.find(o => o.value === category).multiplier;
		// Category labels start with their emoji, which keeps the odds board short
		const oddsBoard = market.options.map(o => `${o.label.split(' ')[0]} ${o.multiplier}:1`).join(' · ');

		return interaction.reply(
			`🎲 ${interaction.user} ${result.changed ? 'changed their bet to' : 'bet'} ${formatCoins(wager)} that Lucas's excuse involves **${CATEGORIES[category]}** (pays ${multiplier}:1).\n` +
			`-# Today's odds: ${oddsBoard}\n` +
			`-# ${totalBets} bet${totalBets !== 1 ? 's' : ''} on the table — settled when someone runs /gac • Balance: ${formatCoins(result.balance)}`,
		);
	},
};
