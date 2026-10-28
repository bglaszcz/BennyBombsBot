const {
	SlashCommandBuilder, MessageFlags, PermissionFlagsBits,
	ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder,
} = require('discord.js');
const { Bet, BetMarket } = require('../../models');
const bets = require('../../services/bets');
const { formatCoins } = require('../../services/economy');
const { betting } = require('../../config/settings');
const { parseWhen } = require('../../utils/parseWhen');

const MAX_QUESTION_LENGTH = 200;
const HOUR_MS = 60 * 60 * 1000;
const ephemeral = { flags: MessageFlags.Ephemeral };

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

function isAdmin(interaction) {
	return Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild));
}

async function betOnPlayer(interaction, type) {
	const player = interaction.options.getUser('player');
	const choice = interaction.options.getString('side');
	const wager = interaction.options.getInteger('wager');

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
	const hours = interaction.options.getInteger('hours');
	const settleInput = interaction.options.getString('settle_on');

	let settleAt = null;
	if (settleInput) {
		settleAt = parseWhen(settleInput);
		if (!settleAt) {
			return interaction.reply({ content: `Couldn't read "${settleInput}" as a date. Try \`friday 6pm\`, \`11/3\`, \`tomorrow\`, or \`3d\`. 📅`, ...ephemeral });
		}
		if (settleAt <= new Date()) {
			return interaction.reply({ content: `<t:${Math.floor(settleAt.getTime() / 1000)}:f> already happened. No betting on the past. 🔮`, ...ephemeral });
		}
		if (settleAt - Date.now() > betting.maxSettleDays * 24 * HOUR_MS) {
			return interaction.reply({ content: `That's too far out — settle times can be up to ${betting.maxSettleDays} days away. ⏳`, ...ephemeral });
		}
	}

	// Betting stays open until the settle time unless they set hours (and never past it)
	let closesAt = new Date(Date.now() + (hours ?? 24) * HOUR_MS);
	if (settleAt && (!hours || closesAt > settleAt)) closesAt = settleAt;

	const market = await bets.createCustomMarket(interaction.user, question, closesAt, settleAt, bets.betsChannelFor(interaction.channelId));
	const message = await bets.postBetRecord(interaction, {
		content: `🎲 ${interaction.user} opened a bet. Pick a side!`,
		...await bets.customMarketPayload(market),
	});
	if (message) await market.update({ messageId: message.id, channelId: message.channelId });
}

/**
 * Admin ruling: final and immediate, skips the dispute window.
 * @returns {Promise<{ error: string } | { text: string }>}
 */
async function adminRuling(interaction, market, outcome) {
	if (!market) return { error: 'No market with that number. 🤔' };
	if (market.status === 'settled' || market.status === 'void') return { error: 'That one\'s already been settled.' };
	// Automatic markets settle themselves; admins can still call them off
	if (market.type !== 'custom' && outcome !== 'void') return { error: 'That market settles itself. Admins can only void it.' };

	const text = await bets.settleMarketNow(interaction.client, market, outcome);
	if (!text) return { error: 'That one\'s already been settled.' };
	return { text: `🧑‍⚖️ **Admin ruling by ${interaction.user}** — final.\n${text}` };
}

/**
 * Someone involved calls the result: post it with Agree/Dispute buttons, or pay out
 * right away if there's nobody else to agree.
 * @returns {Promise<boolean>} Whether it went through (errors are replied privately)
 */
async function callResult(interaction, marketId, outcome) {
	const called = await bets.proposeOutcome(marketId, interaction.user.id, outcome);
	if (called.error) {
		await interaction.reply({ content: called.error, ...ephemeral });
		return false;
	}

	if (called.final) {
		const text = await bets.settleMarketNow(interaction.client, called.market, outcome);
		await bets.postBetRecord(interaction, { content: text ?? 'That one\'s already been settled.' });
		return true;
	}

	const message = await bets.postBetRecord(interaction, bets.proposalPayload(called.market, called.involved));
	if (message) await bets.setProposalMessage(called.market, message);
	await bets.refreshMarketPost(interaction.client, called.market);
	return true;
}

async function settleMarket(interaction) {
	const marketId = interaction.options.getInteger('market');
	const outcome = interaction.options.getString('outcome');

	if (isAdmin(interaction)) {
		const ruling = await adminRuling(interaction, await BetMarket.findByPk(marketId), outcome);
		if (ruling.error) return interaction.reply({ content: ruling.error, ...ephemeral });
		return bets.postBetRecord(interaction, { content: ruling.text, allowedMentions: { parse: [] } });
	}
	await callResult(interaction, marketId, outcome);
}

async function listMarkets(interaction) {
	const markets = await bets.listOpenMarkets(interaction.user.id);
	if (markets.length === 0) {
		return interaction.reply({ content: 'No open bets right now. Start one with `/bet create`. 🎲', ...ephemeral });
	}

	const lines = markets.map(m => {
		const status = m.type === 'custom'
			? bets.customStatusLine(m)
			: `closes <t:${Math.floor(m.closesAt.getTime() / 1000)}:R>`;
		const link = m.messageId ? ` — [bet here](https://discord.com/channels/${interaction.guildId}/${m.channelId}/${m.messageId})` : '';
		const secret = m.type === 'dethtoot' ? ' 🤫 *(secret — only bettors see this)*' : '';
		return `\`#${m.id}\` ${m.question} • ${status}${link}${secret}`;
	});
	return interaction.reply({ content: `🎲 **Open markets**\n${lines.join('\n')}`, ...ephemeral });
}

/** "bet-settle:<marketId>:<yes|no|void|snooze>" buttons on a settle reminder */
async function handleSettleButton(interaction) {
	const [, marketId, outcome] = interaction.customId.split(':');
	const clearReminder = () => interaction.message.edit({ components: [] }).catch(() => null);

	if (outcome === 'snooze') {
		const market = await BetMarket.findByPk(marketId);
		if (!market || !['open', 'locked'].includes(market.status)) return interaction.update({ components: [] });
		const involved = market.creatorId === interaction.user.id ||
			await Bet.count({ where: { marketId: market.id, userId: interaction.user.id } }) > 0;
		if (!involved && !isAdmin(interaction)) {
			return interaction.reply({ content: 'Only people in this bet can snooze it. 🙅', ...ephemeral });
		}
		const settleAt = new Date(Date.now() + betting.settleReminderEveryHours * HOUR_MS);
		await market.update({ settleAt, remindedAt: null });
		await bets.refreshMarketPost(interaction.client, market);
		return interaction.update({
			content: `${interaction.message.content}\n😴 ${interaction.user} snoozed it — I'll ask again <t:${Math.floor(settleAt.getTime() / 1000)}:R>.`,
			components: [],
			allowedMentions: { parse: [] },
		});
	}

	if (isAdmin(interaction)) {
		const ruling = await adminRuling(interaction, await BetMarket.findByPk(marketId), outcome);
		if (ruling.error) return interaction.reply({ content: ruling.error, ...ephemeral });
		await bets.postBetRecord(interaction, { content: ruling.text, allowedMentions: { parse: [] } });
		return clearReminder();
	}

	if (await callResult(interaction, marketId, outcome)) await clearReminder();
}

/** "bet-agree:<marketId>" / "bet-dispute:<marketId>" buttons on a called result */
async function handleProposalResponse(interaction, action) {
	const [, marketId] = interaction.customId.split(':');
	const response = await bets.respondToProposal(marketId, interaction.user.id, action);

	if (response.error) {
		if (response.stale) return interaction.update({ components: [] });
		return interaction.reply({ content: response.error, ...ephemeral });
	}

	const quiet = { allowedMentions: { parse: [] } };
	if (response.disputed) {
		await interaction.update({
			content: `${interaction.message.content}\n⚠️ **Disputed by ${interaction.user}.** An admin has to make the call: \`/bet settle market:${marketId}\``,
			components: [],
			...quiet,
		});
		return bets.refreshMarketPost(interaction.client, response.market);
	}

	if (response.final) {
		await interaction.update({ content: `${interaction.message.content}\n🤝 Everyone agreed.`, components: [], ...quiet });
		const text = await bets.settleMarketNow(interaction.client, response.market, response.market.proposal.outcome);
		if (text) await interaction.followUp({ content: text, ...quiet });
		return;
	}

	await interaction.update({ ...bets.proposalPayload(response.market, response.involved), ...quiet });
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
			.addStringOption(option => option
				.setName('settle_on')
				.setDescription('When you\'ll know the answer; I\'ll ping you to settle. e.g. "friday 6pm", "11/3", "3d"')
				.setMaxLength(40)
				.setRequired(false))
			.addIntegerOption(option => option
				.setName('hours')
				.setDescription('How long betting stays open (default: until settle_on, or 24)')
				.setMinValue(1)
				.setMaxValue(168)
				.setRequired(false)))
		.addSubcommand(sub => sub
			.setName('settle')
			.setDescription('Call the result of a bet you\'re in (others can dispute). Admin calls are final.')
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
		'bet-settle': handleSettleButton,
		'bet-agree': interaction => handleProposalResponse(interaction, 'agree'),
		'bet-dispute': interaction => handleProposalResponse(interaction, 'dispute'),
	},

	async execute(interaction) {
		const subcommand = interaction.options.getSubcommand();
		if (subcommand === 'create') return createMarket(interaction);
		if (subcommand === 'settle') return settleMarket(interaction);
		if (subcommand === 'list') return listMarkets(interaction);
		return betOnPlayer(interaction, subcommand);
	},
};
