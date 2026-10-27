const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { ITEMS, parseEmojis, buyGmcEmojis, buyBotNickname, buyRiggedExcuse } = require('../../services/shop');
const { formatCoins } = require('../../services/economy');
const { shop } = require('../../config/settings');

const SOLD_OUT = {
	gmc: "Tomorrow's GMC is already sponsored. Try again tomorrow. 🌅",
	nickname: "Someone's already renamed me. Wait for it to wear off. 🤖",
	rig: "The next excuse is already rigged. Can't double-rig, that's just fraud. 🕵️",
};

/** Turn a purchase result into a reply, or null on success */
function failureMessage(itemKey, result) {
	if (result.error === 'sold-out') return SOLD_OUT[itemKey];
	if (result.error === 'funds') {
		return `That costs ${formatCoins(ITEMS[itemKey].price)} and you have ${formatCoins(result.balance)}. Go chat some more. 💬`;
	}
	return null;
}

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('buy')
		.setDescription('Spend Bomb Bucks in the shop (see /shop)')
		.addSubcommand(sub => sub
			.setName('gmc')
			.setDescription(`${ITEMS.gmc.description} (${ITEMS.gmc.price})`)
			.addStringOption(option => option
				.setName('emojis')
				.setDescription('Up to 6 emojis, e.g. 🦆🔥🍑 (this server\'s custom emojis work too)')
				.setRequired(true)))
		.addSubcommand(sub => sub
			.setName('nickname')
			.setDescription(`${ITEMS.nickname.description} (${ITEMS.nickname.price})`)
			.addStringOption(option => option
				.setName('name')
				.setDescription('My new nickname')
				.setMaxLength(32)
				.setRequired(true)))
		.addSubcommand(sub => sub
			.setName('rig')
			.setDescription(`${ITEMS.rig.description} (${ITEMS.rig.price})`)
			.addStringOption(option => option
				.setName('theme')
				.setDescription('What the excuse has to be about, e.g. "a goose"')
				.setMaxLength(150)
				.setRequired(true))),

	async execute(interaction) {
		const itemKey = interaction.options.getSubcommand();
		const ephemeral = { flags: MessageFlags.Ephemeral };

		if (itemKey === 'gmc') {
			const parsed = parseEmojis(interaction.options.getString('emojis'), interaction.guild);
			if (parsed.error) return interaction.reply({ content: parsed.error, ...ephemeral });

			const result = await buyGmcEmojis(interaction.user, parsed.emojis);
			const failure = failureMessage(itemKey, result);
			if (failure) return interaction.reply({ content: failure, ...ephemeral });

			return interaction.reply(`🌅 ${interaction.user} sponsored tomorrow's GMC: ${parsed.emojis.join('')}\n-# Balance: ${formatCoins(result.balance)}`);
		}

		if (itemKey === 'nickname') {
			if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ChangeNickname)) {
				return interaction.reply({ content: "I don't have permission to change my own nickname, so I can't sell this one. 😔", ...ephemeral });
			}
			const nickname = interaction.options.getString('name');

			const result = await buyBotNickname(interaction.user, interaction.guild, nickname);
			const failure = failureMessage(itemKey, result);
			if (failure) return interaction.reply({ content: failure, ...ephemeral });

			return interaction.reply(`🤖 ${interaction.user} paid to rename me **${nickname}** for ${shop.botNicknameHours} hours. I hate it here.\n-# Balance: ${formatCoins(result.balance)}`);
		}

		// rig — kept secret, the reveal comes when /gac posts
		const result = await buyRiggedExcuse(interaction.user, interaction.options.getString('theme'));
		const failure = failureMessage(itemKey, result);
		if (failure) return interaction.reply({ content: failure, ...ephemeral });

		return interaction.reply({
			content: `🕵️ Done. Lucas's next excuse will be about that. Nobody has to know... until /gac reveals it.\n-# Balance: ${formatCoins(result.balance)}`,
			...ephemeral,
		});
	},
};
