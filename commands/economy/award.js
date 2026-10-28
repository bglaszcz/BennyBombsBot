// commands/economy/award.js
// bot.js auto-loads every .js file under /commands; the folder name ("economy")
// is the /help category. After adding this file run: npm run deploy

const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { economy } = require('../../config/settings');
const { adjustCoins, formatCoins, withTransaction, InsufficientFundsError } = require('../../services/economy');

// Discord snowflakes are 17-20 digits
const MESSAGE_ID_RE = /^\d{17,20}$/;
const MAX_AWARD = 1000;

module.exports = {
	data: new SlashCommandBuilder()
		.setName('award')
		.setDescription(`Give some of your ${economy.name} to a user as an award`)
		.setDMPermission(false)
		.addUserOption(option =>
			option
				.setName('user')
				.setDescription('Who to award to')
				.setRequired(true))
		.addIntegerOption(option =>
			option
				.setName('bucks')
				.setDescription(`How many ${economy.name} to award`)
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(MAX_AWARD))
		.addStringOption(option =>
			option
				.setName('description')
				// Discord caps option descriptions at 100 characters
				.setDescription('Free text, or a Discord message ID to award for that specific message')
				.setMaxLength(500)),

	async execute(interaction) {
		const target = interaction.options.getUser('user');
		const bucks = interaction.options.getInteger('bucks');
		const description = interaction.options.getString('description')?.trim() || null;

		if (target.bot) {
			return interaction.reply({ content: 'Bots can\'t hold bucks.', flags: MessageFlags.Ephemeral });
		}
		if (target.id === interaction.user.id) {
			return interaction.reply({ content: 'You can\'t award bucks to yourself.', flags: MessageFlags.Ephemeral });
		}

		// If the description is a message ID, look it up in this channel
		let linkedMessage = null;
		if (description && MESSAGE_ID_RE.test(description)) {
			linkedMessage = await interaction.channel.messages.fetch(description).catch(() => null);
			if (!linkedMessage) {
				return interaction.reply({
					content: 'That looks like a message ID, but I couldn\'t find that message in this channel. '
						+ 'Run /award in the same channel as the message, or use free text instead.',
					flags: MessageFlags.Ephemeral,
				});
			}
		}

		await interaction.deferReply();

		// Transfer: take from the awarder and give to the target in ONE transaction,
		// so either both balances change or neither does.
		// Rows are locked in a fixed (id) order so two people awarding each other
		// at the same moment can't deadlock.
		const ops = [[interaction.user, -bucks], [target, bucks]]
			.sort(([a], [b]) => (a.id < b.id ? -1 : 1));

		let balances;
		try {
			balances = await withTransaction(null, async t => {
				const result = {};
				for (const [user, delta] of ops) {
					result[user.id] = await adjustCoins(user, delta, t);
				}
				return result;
			});
		}
		catch (error) {
			if (error instanceof InsufficientFundsError) {
				return interaction.editReply(
					`You only have ${formatCoins(error.balance)}, so you can't award ${formatCoins(bucks)}.`,
				);
			}
			console.error('Failed to award bucks:', error);
			return interaction.editReply('Something went wrong saving that award. No bucks were moved.');
		}

		const embed = new EmbedBuilder()
			.setColor(0x2ecc71)
			.setTitle(`${economy.name} awarded`)
			.setDescription(`${interaction.user} awarded ${formatCoins(bucks)} to ${target}`)
			.setFooter({
				text: `New balances: ${interaction.user.username} ${balances[interaction.user.id].toLocaleString('en-US')}`
					+ ` · ${target.username} ${balances[target.id].toLocaleString('en-US')}`,
			});

		if (linkedMessage) {
			const excerpt = linkedMessage.content
				? linkedMessage.content.slice(0, 200) + (linkedMessage.content.length > 200 ? '…' : '')
				: '*(no text)*';
			embed.addFields({
				name: 'For this message',
				value: `[Jump to message](${linkedMessage.url})\n> ${excerpt.replace(/\n/g, '\n> ')}`,
			});
		}
		else if (description) {
			embed.addFields({ name: 'For', value: description });
		}

		// Mention in content so the recipient actually gets pinged (embeds don't)
		return interaction.editReply({
			content: `${target}`,
			embeds: [embed],
			allowedMentions: { users: [target.id] },
		});
	},
};
