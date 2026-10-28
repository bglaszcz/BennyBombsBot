// commands/economy/award.js
// bot.js auto-loads every .js file under /commands; the folder name ("economy")
// is the /help category. After adding this file run: npm run deploy

const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { economy } = require('../../config/settings');
const { adjustCoins, formatCoins, withTransaction, InsufficientFundsError } = require('../../services/economy');
const { Trial } = require('../../models');
const { Op } = require('sequelize');
const { getNickname } = require('../../utils/getNickname');

// Discord snowflakes are 17-20 digits
const MESSAGE_ID_RE = /^\d{17,20}$/;
const MAX_AWARD = 1000;

// Bigger awards get a fancier card. First tier whose `min` the amount reaches wins.
const TIERS = [
	{
		min: 500, emoji: '👑', name: 'Legendary Award', color: 0x9B59B6,
		flavor: ['Generational wealth has been transferred.', 'Somebody frame this.', 'The economy will feel this one.'],
	},
	{
		min: 100, emoji: '💰', name: 'Big Award', color: 0xF1C40F,
		flavor: ['Now THAT is appreciation.', 'Make it rain.', 'Someone\'s getting a raise.'],
	},
	{
		min: 25, emoji: '🏅', name: 'Award', color: 0xBDC3C7,
		flavor: ['Well earned.', 'A respectable gesture.', 'Recognition, with cash.'],
	},
	{
		min: 0, emoji: '🪙', name: 'Tip', color: 0xCD7F32,
		flavor: ['Small but heartfelt.', 'Don\'t spend it all in one place.', 'It\'s the thought that counts.', 'Tossed into the tip jar.'],
	},
];

function tierFor(amount) {
	return TIERS.find(tier => amount >= tier.min);
}

function pick(list) {
	return list[Math.floor(Math.random() * list.length)];
}

function coins(amount) {
	return `${amount.toLocaleString('en-US')} ${economy.emoji}`;
}

module.exports = {
	// Each award pings the recipient, so keep it from being spammed
	cooldown: 15,
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
			.setMaxLength(500)
			.setRequired(true)),

	async execute(interaction) {
		const target = interaction.options.getUser('user');
		const bucks = interaction.options.getInteger('bucks');
		const description = interaction.options.getString('description').trim();
		const ephemeral = { flags: MessageFlags.Ephemeral };

		if (target.bot) {
			return interaction.reply({ content: "Bots can't hold bucks. 🤖", ...ephemeral });
		}
		if (target.id === interaction.user.id) {
			return interaction.reply({ content: 'You can\'t award bucks to yourself.', flags: MessageFlags.Ephemeral });
		}

		// No hiding money from small claims court: defendants can't give coins away mid-trial
		const pendingSuit = await Trial.findOne({
			where: { defendantId: interaction.user.id, status: 'open', damages: { [Op.gt]: 0 } },
		});
		if (pendingSuit) {
			const link = pendingSuit.messageId
				? ` ([case #${pendingSuit.id}](https://discord.com/channels/${interaction.guildId}/${pendingSuit.channelId}/${pendingSuit.messageId}))`
				: '';
			return interaction.reply({
				content: `Nice try. You're being sued${link}, so your assets are frozen until the verdict. 🧊⚖️`,
				flags: MessageFlags.Ephemeral,
			});
		}

		// If the description is a message ID, look it up in this channel
		let linkedMessage = null;
		if (MESSAGE_ID_RE.test(description)) {
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
			return interaction.editReply('Something went wrong saving that award. No bucks were moved.');
		}

		const tier = tierFor(bucks);
		const giverName = getNickname(interaction.user.id, interaction.user.username);
		const targetName = getNickname(target.id, target.username);

		const embed = new EmbedBuilder()
			.setColor(tier.color)
			.setAuthor({ name: `${giverName} handed out an award`, iconURL: interaction.user.displayAvatarURL() })
			.setTitle(`${tier.emoji} ${tier.name}: +${coins(bucks)}`)
			.setThumbnail(target.displayAvatarURL({ size: 128 }))
			.setDescription(`${interaction.user} ➜ ${target}`)
			.setFooter({ text: pick(tier.flavor) })
			.setTimestamp();

		if (linkedMessage) {
			const text = linkedMessage.content
				? linkedMessage.content.slice(0, 200) + (linkedMessage.content.length > 200 ? '…' : '')
				: '*(no text)*';
			embed.addFields({
				name: '📌 For this message',
				value: `> ${excerpt.replace(/\n/g, '\n> ')}\n[Jump to message](${linkedMessage.url})`,
			});
		}
		else if (description) {
			embed.addFields({ name: '📝 For', value: `*${description}*` });
		}

		embed.addFields(
			{ name: `${targetName}'s wallet`, value: coins(balances[target.id]), inline: true },
			{ name: `${giverName}'s wallet`, value: coins(balances[interaction.user.id]), inline: true },
		);

		// Mention in content so the recipient actually gets pinged (embeds don't)
		return interaction.editReply({
			content: `${tier.emoji} ${target}, you've been awarded!`,
			embeds: [embed],
			allowedMentions: { users: [target.id] },
		});
	},
};
