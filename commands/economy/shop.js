const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { ITEMS, getAvailability } = require('../../services/shop');
const { getBalance, formatCoins } = require('../../services/economy');
const { economy } = require('../../config/settings');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('shop')
		.setDescription(`See what your ${economy.name} can buy`),

	async execute(interaction) {
		const [availability, balance] = await Promise.all([getAvailability(), getBalance(interaction.user.id)]);

		const embed = new EmbedBuilder()
			.setColor(0xE67E22)
			.setTitle(`🛒 The ${economy.name} Shop`)
			.setDescription(`You have ${formatCoins(balance)}. Buy with \`/buy <item>\`.`)
			.addFields(Object.entries(ITEMS).map(([key, item]) => ({
				name: `${item.name} — ${item.price} ${economy.emoji}`,
				value: `${item.description}\n\`/buy ${key}\`${availability[key] ? ` • ❌ ${availability[key]}` : ' • ✅ Available'}`,
			})));

		return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},
};
