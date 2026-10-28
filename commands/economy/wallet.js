const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getBalance, getRichest, formatCoins } = require('../../services/economy');
const { getOpenBets, optionLabel } = require('../../services/bets');
const { economy } = require('../../config/settings');
const { getNickname } = require('../../utils/getNickname');

const MEDALS = ['🥇', '🥈', '🥉'];

module.exports = {
	data: new SlashCommandBuilder()
		.setName('wallet')
		.setDescription(`Check your ${economy.name} balance and open bets`)
		.addUserOption(option => option
			.setName('user')
			.setDescription('Whose wallet to peek at (defaults to you)')
			.setRequired(false)),

	async execute(interaction) {
		const target = interaction.options.getUser('user') || interaction.user;
		const [balance, allOpenBets, richest] = await Promise.all([
			getBalance(target.id),
			getOpenBets(target.id),
			getRichest(5),
		]);

		// Deth toot bets are secret: never in the public embed, only shown privately to their owner
		const openBets = allOpenBets.filter(({ market }) => market.type !== 'dethtoot');
		const secretBets = allOpenBets.filter(({ market }) => market.type === 'dethtoot');

		const atStake = openBets.reduce((sum, { bet }) => sum + bet.wager, 0);
		const embed = new EmbedBuilder()
			.setColor(0xE67E22)
			.setTitle(`${economy.emoji} ${getNickname(target.id, target.username)}'s Wallet`)
			.setDescription(`Balance: ${formatCoins(balance)}${atStake ? `\nRiding on open bets: ${formatCoins(atStake)}` : ''}`);

		if (openBets.length > 0) {
			embed.addFields({
				name: '🎲 Open bets',
				value: openBets.slice(0, 10)
					.map(({ bet, market }) => `• ${formatCoins(bet.wager)} on **${optionLabel(market, bet.choice)}** — ${market.question}`)
					.join('\n'),
			});
		}

		if (richest.length > 0) {
			embed.addFields({
				name: '💰 Richest degenerates',
				value: richest.map((u, i) => `${MEDALS[i] || `${i + 1}.`} ${getNickname(u.userId, u.username)} — ${formatCoins(u.coins)}`).join('\n'),
			});
		}

		embed.setFooter({ text: 'Earn by chatting, levelling up, and posting Wordle/MapTap scores' });
		await interaction.reply({ embeds: [embed] });

		if (secretBets.length > 0 && target.id === interaction.user.id) {
			await interaction.followUp({
				content: '🤫 **Your secret deth toot bets**\n' + secretBets
					.map(({ bet, market }) => `• ${formatCoins(bet.wager)} on **${optionLabel(market, bet.choice)}** — ${market.question}`)
					.join('\n'),
				flags: MessageFlags.Ephemeral,
			});
		}
	},
};
