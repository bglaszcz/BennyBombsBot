const { Events, Collection, MessageFlags } = require('discord.js');

// commandName -> (userId -> last used timestamp)
const cooldowns = new Collection();

/**
 * Commands can export `cooldown` (seconds) to rate-limit each user.
 * @returns {number} Seconds left to wait, or 0 if the command may run
 */
function getCooldownRemaining(command, userId) {
	if (!command.cooldown) return 0;

	const now = Date.now();
	const timestamps = cooldowns.ensure(command.data.name, () => new Collection());
	const lastUsed = timestamps.get(userId);
	const cooldownMs = command.cooldown * 1000;

	if (lastUsed && now - lastUsed < cooldownMs) {
		return Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
	}

	timestamps.set(userId, now);
	return 0;
}

async function replyWithError(interaction) {
	const payload = { content: 'Something broke running that. 😵 Try again in a bit.', flags: MessageFlags.Ephemeral };
	try {
		if (interaction.replied || interaction.deferred) {
			await interaction.followUp(payload);
		}
		else {
			await interaction.reply(payload);
		}
	}
	catch (error) {
		console.error('Could not send error reply:', error.message);
	}
}

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		// Buttons / select menus: customId is "<prefix>:<args...>", routed to the
		// handler a command registered under `components`
		if (interaction.isMessageComponent()) {
			const prefix = interaction.customId.split(':')[0];
			const handler = interaction.client.components.get(prefix);
			// No handler means a collector elsewhere owns this component
			if (!handler) return;

			try {
				await handler(interaction);
			}
			catch (error) {
				console.error(`Error handling component ${interaction.customId}:`, error);
				await replyWithError(interaction);
			}
			return;
		}

		if (!interaction.isChatInputCommand() && !interaction.isContextMenuCommand()) return;

		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		const remaining = getCooldownRemaining(command, interaction.user.id);
		if (remaining > 0) {
			await interaction.reply({
				content: `Slow down! You can use \`${interaction.commandName}\` again in ${remaining}s. ⏳`,
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		try {
			await command.execute(interaction);
		}
		catch (error) {
			console.error(`Error executing ${interaction.commandName}:`, error);
			await replyWithError(interaction);
		}
	},
};
