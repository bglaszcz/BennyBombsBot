const {
	SlashCommandBuilder, MessageFlags, PermissionFlagsBits,
	ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const { BetMarket } = require('../../models');
const bets = require('../../services/bets');
const { formatCoins } = require('../../services/economy');
const { betting } = require('../../config/settings');

const MAX_QUESTION_LENGTH = 200;

function addPlayerAndWager(sub, sides) {
	return sub
		.addUserOption(option => option.setName('player').setDescription('Who you\'re betting on').setRequired(true))
		.addStringOption(option => option.setName('side').setDescription('Your pick').setRequired(true).addChoices(...sides))
		.addIntegerOption(option => option
			.setName('wager')
			.setDescription('Bomb Bucks to wager')
			.setMinValue(betting.minWager)
			.setMaxValue(betting.maxWager)
			.setRequired(true));
}

/** "pays 1:1" style description of a fixed-odds option */
function oddsText(option) {
	return option.multiplier === 1 ? 'pays 1:1' : `pays ${option.multiplier}:1`;
}

async function betOnPlayer(interaction, type) {
	const player = interaction.options.getUser('player');
	const choice = interaction.options.getString('side');
	const wager = interaction.options.getInteger('wager');
	const ephemeral = { flags: MessageFlags.Ephemeral };

	if (player.bot) return interaction.reply({ content: 'Bots don\'t play. Or toot. 🤖', ...ephemeral });
	// You control your own score and your own toots
	if (player.id === interaction.user.id) {
		return interaction.reply({ content: 'No betting on yourself — that\'s match fixing. 🚔', ...ephemeral });
	}

	const channelId = bets.betsChannelFor(interaction.channelId);
	let market;
	if (type === 'dethtoot') {
		market = await bets.openDethTootMarket(player, channelId);
	}
	else {
		const opened = await bets.openScoreMarket(type, player, channelId);
		if (opened.error) return interaction.reply({ content: opened.error, ...ephemeral });
		market = opened.market;
	}

	const result = await bets.placeBet(market, interaction.user, choice, wager);
	if (result.error) return interaction.reply({ content: result.error, ...ephemeral });

	const option = market.options.find(o => o.value === choice);

	// Deth toot bets stay secret until they settle — a public bet could scare (or goad) the target
	if (type === 'dethtoot') {
		const closes = Math.floor(market.closesAt.getTime() / 1000);
		return interaction.reply({
			content: `🤫 You ${result.changed ? 'changed your bet to' : 'bet'} ${formatCoins(wager)} on **${option.label}** (${oddsText(option)})\n` +
				`> ${market.question}\n-# Only you can see this. Window closes <t:${closes}:R> • Balance: ${formatCoins(result.balance)}`,
			...ephemeral,
		});
	}

	await bets.postBetRecord(interaction, {
		content: `🎲 ${interaction.user} ${result.changed ? 'changed their bet to' : 'bet'} ${formatCoins(wager)} on **${option.label}** (${oddsText(option)})\n` +
			`> ${market.question}\n-# Settles when they post • Balance: ${formatCoins(result.balance)}`,
	});
}

async function createMarket(interaction) {
	const question = interaction.options.getString('question');
	const hours = interaction.options.getInteger('hours') ?? 24;

	const market = await bets.createCustomMarket(interaction.user, question, hours, bets.betsChannelFor(interaction.channelId));
	const message = await bets.postBetRecord(interaction, {
		content: `🎲 ${interaction.user} opened a bet. Pick a side!`,
		...await bets.customMarketPayload(market),
	});
	if (message) await market.update({ messageId: message.id, channelId: message.channelId });
}

async function settleMarket(interaction) {
	const market = await BetMarket.findByPk(interaction.options.getInteger('market'));
	const outcome = interaction.options.getString('outcome');
	const ephemeral = { flags: MessageFlags.Ephemeral };
	const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

	if (!market) return interaction.reply({ content: 'No market with that number. 🤔', ...ephemeral });
	if (market.status === 'settled' || market.status === 'void') {
		return interaction.reply({ content: 'That one\'s already been settled.', ...ephemeral });
	}
	// Automatic markets settle themselves; admins can still call them off
	if (market.type !== 'custom' && !(isAdmin && outcome === 'void')) {
		return interaction.reply({ content: 'That market settles itself. Admins can only void it.', ...ephemeral });
	}
	if (market.creatorId !== interaction.user.id && !isAdmin) {
		return interaction.reply({ content: `Only <@${market.creatorId}> or an admin can settle that one.`, ...ephemeral });
	}

	const result = await bets.resolveMarket(market.id, outcome === 'void' ? null : outcome);
	if (!result) return interaction.reply({ content: 'That one\'s already been settled.', ...ephemeral });

	await bets.refreshMarketPost(interaction.client, result.market);
	await bets.postBetRecord(interaction, { content: result.text ?? `🎲 **${market.question}** settled — nobody had bet on it.` });
}

async function listMarkets(interaction) {
	const markets = await bets.listOpenMarkets(interaction.user.id);
	if (markets.length === 0) {
		return interaction.reply({ content: 'No open bets right now. Start one with `/bet create`. 🎲', flags: MessageFlags.Ephemeral });
	}

	const lines = markets.map(m => {
		const closes = `<t:${Math.floor(m.closesAt.getTime() / 1000)}:R>`;
		const status = m.status === 'locked' ? 'awaiting settlement' : `closes ${closes}`;
		const link = m.messageId ? ` — [bet here](https://discord.com/channels/${interaction.guildId}/${m.channelId}/${m.messageId})` : '';
		const secret = m.type === 'dethtoot' ? ' 🤫 *(secret — only bettors see this)*' : '';
		return `\`#${m.id}\` ${m.question} • ${status}${link}${secret}`;
	});
	return interaction.reply({ content: `🎲 **Open markets**\n${lines.join('\n')}`, flags: MessageFlags.Ephemeral });
}

/** "bet-pick:<marketId>:<choice>" button on a custom market post — asks how much */
async function handleBetPick(interaction) {
	const [, marketId, choice] = interaction.customId.split(':');
	const modal = new ModalBuilder()
		.setCustomId(`bet-wager:${marketId}:${choice}`)
		.setTitle(`Bet ${choice === 'yes' ? 'Yes' : 'No'}`)
		.addComponents(new ActionRowBuilder().addComponents(
			new TextInputBuilder()
				.setCustomId('wager')
				.setLabel(`Wager (${betting.minWager}-${betting.maxWager} Bomb Bucks)`)
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setMaxLength(5),
		));
	await interaction.showModal(modal);
}

/** "bet-wager:<marketId>:<choice>" modal submit */
async function handleBetWager(interaction) {
	const [, marketId, choice] = interaction.customId.split(':');
	const wager = Number.parseInt(interaction.fields.getTextInputValue('wager'), 10);
	const ephemeral = { flags: MessageFlags.Ephemeral };

	if (!Number.isInteger(wager)) return interaction.reply({ content: 'That\'s not a number. 🤨', ...ephemeral });

	const market = await BetMarket.findByPk(marketId);
	if (!market) return interaction.reply({ content: 'That bet doesn\'t exist anymore.', ...ephemeral });

	const result = await bets.placeBet(market, interaction.user, choice, wager);
	if (result.error) return interaction.reply({ content: result.error, ...ephemeral });

	await bets.postBetRecord(interaction, {
		content: `🎲 ${interaction.user} ${result.changed ? 'changed their bet to' : 'put'} ${formatCoins(wager)} on **${bets.optionLabel(market, choice)}**\n> ${market.question}`,
	});
	await bets.refreshMarketPost(interaction.client, market);
}

module.exports = {
	cooldown: 3,
	data: new SlashCommandBuilder()
		.setName('bet')
		.setDescription('Bet Bomb Bucks on your friends')
		.addSubcommand(sub => addPlayerAndWager(sub
			.setName('wordle')
			.setDescription('Over/under on someone\'s Wordle today (line and odds set from their recent games)'),
		[{ name: 'Under (fewer guesses)', value: 'under' }, { name: 'Over (more guesses or fail)', value: 'over' }]))
		.addSubcommand(sub => addPlayerAndWager(sub
			.setName('maptap')
			.setDescription('Over/under on someone\'s MapTap score today (line and odds set from their recent games)'),
		[{ name: 'Over', value: 'over' }, { name: 'Under', value: 'under' }]))
		.addSubcommand(sub => addPlayerAndWager(sub
			.setName('dethtoot')
			.setDescription('Secret bet: will they deth toot in the next 24h? Only you see it until it settles'),
		[{ name: 'Yes, they\'ll toot', value: 'yes' }, { name: 'No, they stay clean', value: 'no' }]))
		.addSubcommand(sub => sub
			.setName('create')
			.setDescription('Open a yes/no bet on anything — winners split the losers\' pot')
			.addStringOption(option => option
				.setName('question')
				.setDescription('e.g. "Will Ryn bill a client this week?"')
				.setMaxLength(MAX_QUESTION_LENGTH)
				.setRequired(true))
			.addIntegerOption(option => option
				.setName('hours')
				.setDescription('How long betting stays open (default 24)')
				.setMinValue(1)
				.setMaxValue(168)
				.setRequired(false)))
		.addSubcommand(sub => sub
			.setName('settle')
			.setDescription('Settle a bet you created (admins can void any bet)')
			.addIntegerOption(option => option.setName('market').setDescription('Market number (see /bet list)').setRequired(true))
			.addStringOption(option => option
				.setName('outcome')
				.setDescription('What happened')
				.setRequired(true)
				.addChoices(
					{ name: 'Yes', value: 'yes' },
					{ name: 'No', value: 'no' },
					{ name: 'Call it off (refund everyone)', value: 'void' },
				)))
		.addSubcommand(sub => sub
			.setName('list')
			.setDescription('Show open bets')),

	components: {
		'bet-pick': handleBetPick,
		'bet-wager': handleBetWager,
	},

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		if (subcommand === 'create') return createMarket(interaction);
		if (subcommand === 'settle') return settleMarket(interaction);
		if (subcommand === 'list') return listMarkets(interaction);
		return betOnPlayer(interaction, subcommand);
	},
};
