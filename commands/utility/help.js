const { SlashCommandBuilder, EmbedBuilder, MessageFlags, ApplicationCommandOptionType } = require('discord.js');

const CATEGORY_LABELS = {
	fun: '🤪 Fun',
	games: '🎮 Games',
	economy: '💣 Bomb Bucks',
	wordle: '🟩 Wordle',
	maptap: '🗺️ MapTap',
	social: '👥 Social',
	finance: '💸 Finance',
	utility: '🛠️ Utility',
};

function isSlashCommand(command) {
	// Context menu builders carry a `type`; slash commands don't
	return command.data.type === undefined;
}

function describeCommand(command) {
	const json = command.data.toJSON();
	const lines = [json.description];

	const subcommands = (json.options || []).filter(o => o.type === ApplicationCommandOptionType.Subcommand);
	if (subcommands.length > 0) {
		lines.push('', ...subcommands.map(sub => `\`/${json.name} ${sub.name}\` — ${sub.description}`));
	}
	else if (json.options?.length) {
		lines.push('', ...json.options.map(o => `\`${o.name}\`${o.required ? '' : ' (optional)'} — ${o.description}`));
	}
	return lines.join('\n');
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Show help menu')
		.addStringOption(option => option
			.setName('command')
			.setDescription('Get details for one command')
			.setRequired(false)),
	async execute(interaction) {
		const commands = interaction.client.commands.filter(isSlashCommand);
		const requested = interaction.options.getString('command')?.replace(/^\//, '').toLowerCase();

		if (requested) {
			const command = commands.get(requested);
			if (!command) {
				return interaction.reply({ content: `There's no \`/${requested}\` command. 🤔`, flags: MessageFlags.Ephemeral });
			}
			const embed = new EmbedBuilder()
				.setColor('#0099ff')
				.setTitle(`/${command.data.name}`)
				.setDescription(describeCommand(command));
			return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
		}

		const byCategory = new Map();
		for (const command of commands.values()) {
			const list = byCategory.get(command.category) || [];
			list.push(`\`/${command.data.name}\``);
			byCategory.set(command.category, list);
		}

		const embed = new EmbedBuilder()
			.setColor('#0099ff')
			.setTitle('📖 BennyBombsBot Commands')
			.setDescription('Use `/help command:<name>` for details. Right-click any message → **Apps** to quote, nominate, or put it on trial.');

		for (const [category, names] of [...byCategory.entries()].sort()) {
			embed.addFields({ name: CATEGORY_LABELS[category] || category, value: names.sort().join(' ') });
		}

		return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},
};
