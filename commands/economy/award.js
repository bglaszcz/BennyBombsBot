// commands/economy/award.js
// bot.js auto-loads every .js file under /commands; the folder name ("economy")
// is the /help category. After adding this file run: npm run deploy

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { economy } = require('../../config/settings');
const { adjustCoins, formatCoins, withTransaction, InsufficientFundsError } = require('../../services/economy');

// Discord snowflakes are 17-20 digits
const MESSAGE_ID_RE = /^\d{17,20}$/;
const MAX_AWARD = 1000;

module.exports = {
	cooldown: 5,
	data: new SlashCommandBuilder()
		.setName('award')
		.setDescription(`Give some of your ${economy.name} to someone as an award`)
		.setDMPermission(false)
		.addUserOption(option => option
			.setName('user')
			.setDescription('Who to award')
			.setRequired(true))
		.addIntegerOption(option => option
			.setName('bucks')
			.setDescription(`How many ${economy.name} to give (taken from your balance)`)
			.setMinValue(1)
			.setMaxValue(MAX_AWARD)
			.setRequired(true))
		.addStringOption(option => option
			.setName('description')
			// Discord caps option descriptions at 100 characters
			.setDescription('Free text, or a Discord message ID to award for that specific message')
			.setMaxLength(500)),

	async execute(interaction) {
		const target = interaction.options.getUser('user');
		const bucks = interaction.options.getInteger('bucks');
		const description = interaction.options.getString('description')?.trim() || null;
		const ephemeral = { flags: MessageFlags.Ephemeral };

		if (target.bot) {
			return interaction.reply({ content: "Bots can't hold bucks. 🤖", ...ephemeral });
		}
		if (target.id === interaction.user.id) {
			return interaction.reply({ content: "You can't award yourself. That's just moving money between your own pockets. 🙄", ...ephemeral });
		}

		// If the description is a message ID, look it up in this channel
		let linkedMessage = null;
		if (description && MESSAGE_ID_RE.test(description)) {
			linkedMessage = await interaction.channel.messages.fetch(description).catch(() => null);
			if (!linkedMessage) {
				return interaction.reply({
					content: "That looks like a message ID, but I can't find that message in this channel. Run /award in the same channel as the message, or use free text instead.",
					...ephemeral,
				});
			}
		}

		// Transfer from the awarder to the target in ONE transaction: both balances
		// change or neither does. Rows are locked in id order so two people awarding
		// each other at the same moment can't deadlock.
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
				return interaction.reply({
					content: `You can't award ${formatCoins(bucks)} when you only have ${formatCoins(error.balance)}. Go chat some more. 💬`,
					...ephemeral,
				});
			}
			console.error('Failed to award bucks:', error);
			return interaction.reply({ content: 'Something went wrong. No bucks were moved. 😔', ...ephemeral });
		}

		let reply = `🏆 ${interaction.user} awarded ${formatCoins(bucks)} to ${target}`;
		if (linkedMessage) {
			const text = linkedMessage.content
				? linkedMessage.content.slice(0, 200) + (linkedMessage.content.length > 200 ? '…' : '')
				: '(no text)';
			reply += ` for [this message](${linkedMessage.url}):\n> ${text.replace(/\n/g, '\n> ')}`;
		}
		else if (description) {
			reply += `: ${description}`;
		}
		reply += `\n-# Balances: you ${formatCoins(balances[interaction.user.id])} · ${target.username} ${formatCoins(balances[target.id])}`;

		// Only ping the recipient, never @everyone/roles that might be in the description
		return interaction.reply({ content: reply, allowedMentions: { users: [target.id] } });
	},
};
