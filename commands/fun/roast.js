const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const userMemory = require('../../services/userMemory');
const { generateText, SafetyBlockError } = require('../../services/gemini');
const { getNickname } = require('../../utils/getNickname');

function describeMemory(memory) {
	if (!memory) return '(nothing known)';
	const facts = (memory.facts || []).map(f => (typeof f === 'string' ? f : f.text));
	const prefs = Object.entries(memory.preferences || {}).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : v.value}`);
	return [...facts, ...prefs].map(line => `- ${line}`).join('\n') || '(nothing known)';
}

module.exports = {
	cooldown: 20,
	data: new SlashCommandBuilder()
		.setName('roast')
		.setDescription('Get roasted (only works on people who are into the banter)')
		.addUserOption(option => option
			.setName('target')
			.setDescription('Who to roast (defaults to you)')
			.setRequired(false)),

	async execute(interaction) {
		const target = interaction.options.getUser('target') || interaction.user;
		const isSelf = target.id === interaction.user.id;
		const memory = userMemory.peekMemory(target.id);
		const name = getNickname(target.id, target.username);

		if (target.id === interaction.client.user.id) {
			return interaction.reply("Roast myself? I'm a Discord bot running on someone's spare PC. The roast writes itself. 🫠");
		}

		// Only people who've shown they enjoy banter (positive roast score) can be roasted by others
		if (!isSelf && !(memory?.roastScore > 0)) {
			return interaction.reply({
				content: `${name} hasn't opted into the roast pit. They can unlock it by asking me to roast them or trading some trash talk with me. 🔥`,
				flags: MessageFlags.Ephemeral,
			});
		}

		await interaction.deferReply();

		const prompt = `You're a savage but affectionate roast comic in a Discord server full of close friends. Roast ${name}${isSelf ? ' (they asked for it)' : `, at ${getNickname(interaction.user.id, interaction.user.username)}'s request`}.

What you know about ${name}:
${describeMemory(memory)}

Rules:
- 2-4 sentences, punchy, specific to what you know (if you know nothing, roast them for being a mystery)
- Funny, not cruel: no appearance, race, religion, gender, sexuality, disability, or genuinely sensitive topics
- No preamble, no quotation marks`;

		try {
			const roast = await generateText(prompt);
			await interaction.editReply(`🔥 ${target} ${roast}`);
			userMemory.updateRoastScore(target.id, isSelf ? 1 : 0.5);
		}
		catch (error) {
			if (!(error instanceof SafetyBlockError)) throw error;
			await interaction.editReply(`I had a roast for ${name} but it was too spicy for my handlers. 🌶️`);
		}
	},
};
