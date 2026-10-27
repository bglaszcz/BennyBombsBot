const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { UniqueConstraintError } = require('sequelize');
const { GACMessage } = require('../../models');
const { generateText } = require('../../services/gemini');
const { settleBets } = require('../../services/gacBets');
const { dayKey } = require('../../utils/dayKey');

const FALLBACK_EXCUSES = [
  "My new smart doorbell's installation manual is in Swedish and I'm the only one who speaks Swedish in a 3-mile radius.",
  "My HOA is having an emergency meeting about whether the Johnson's garden gnome is 0.3 inches too tall and violates community standards.",
  "I accidentally ordered 200 pounds of quinoa instead of 2 pounds and need to figure out what to do with it before it expires.",
  "My cat learned how to open doors and has been letting all the neighborhood cats into my house for what appears to be some sort of feline summit.",
];

async function generateLucasExcuse(isMayFourth = false) {
  try {
    // Get last 5 excuses from database
    const lastExcuses = await GACMessage.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['excuse'],
    });

    const previousExcuses = lastExcuses.map(e => `- ${e.excuse}`).join("\n");

    const mayFourthInstructions = isMayFourth ? `
SPECIAL OCCASION: Today is May 4th — Star Wars Day. The excuse MUST be Star Wars themed.
Weave in Star Wars references naturally (e.g. lightsabers, Jedi training, the Force, droids, the Kessel Run, Darth Vader, Midi-chlorians, the Death Star, the Millennium Falcon, etc.).
Keep Lucas's clueless middle-manager voice — he takes this very seriously.
` : '';

    const prompt = `You are Lucas, a middle manager in IT who needs to leave work early.
Generate a single, creative excuse for why you need to leave work early today.
${mayFourthInstructions}
IMPORTANT: Generate ONLY the reason/excuse itself. Do NOT include any phrases like:
- "I need to leave early"
- "I have to depart"
- "I need to head out"
- "Sorry for leaving"
- Any apologies or preambles

The excuse should:
- Start directly with the situation/reason
- Be believable but slightly absurd
- Have professional tone but underlying ridiculousness
- Be between 20-80 words
- Make coworkers roll their eyes
- Not involve serious emergencies or health issues
- Not repeat themes from previous excuses

Here are the last 5 excuses that have already been used. DO NOT reuse or be too similar to these:
${previousExcuses || "(none yet)"}

${isMayFourth ? '' : 'Explore a wide range of categories: pets, smart home devices, obscure community rules, minor bureaucratic crises, neighbors\' antics, vehicle oddities, or delivery mishaps.\n'}
EXAMPLES of correct format (notice they start directly with the situation):
- "My neighbor's cat got stuck in my car's exhaust pipe and I'm the only one with the right tools to extract it safely."
- "The artisanal honey I ordered from that obscure beekeeping collective is being delivered during a very specific window, and it requires immediate refrigeration to preserve its delicate floral notes."
- "My robotic lawnmower is currently attempting to engage the neighbor's prize-winning poodle in a turf war and I need to intervene before animal control becomes involved."

Generate only the excuse reason itself - no extra text, quotation marks, or leaving/departing phrases.`;

    return await generateText(prompt);
  }
  catch (error) {
    console.error('Error generating Lucas excuse:', error);
    return FALLBACK_EXCUSES[Math.floor(Math.random() * FALLBACK_EXCUSES.length)];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gac')
    .setDescription('Lucas needs to leave work early again...')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Run in test mode (admins only)')
        .addChoices(
          { name: 'Normal', value: 'normal' },
          { name: 'Test', value: 'test' },
        )
        .setRequired(false)),

  async execute(interaction) {
    const today = new Date();
    const todayString = dayKey(today);
    const currentHour = today.getHours();
    const isTestMode = interaction.options.getString('mode') === 'test';

    // Test mode skips the time and once-a-day limits, so each use is a free Gemini call
    if (isTestMode && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({ content: 'Test mode is for admins only. 🔒', flags: MessageFlags.Ephemeral });
    }

    // Check if current time is between 12pm and 4pm (skip in test mode)
    if (!isTestMode && currentHour < 12) {
      return interaction.reply("GAC can only be used between 12pm and 4pm! Lucas doesn't make excuses outside of afternoon hours. ⏰");
    }

    if (!isTestMode && currentHour >= 16) {
      const existingExcuse = await GACMessage.findOne({ where: { date: todayString } });

      if (existingExcuse) {
        return interaction.reply(`Lucas already made his excuse for today at ${existingExcuse.createdAt.toLocaleString()}`);
      }

      return interaction.reply("Bro it's after 4pm, Lucas is long gone. 🫥");
    }

    const isApril21st2028 = today.getFullYear() === 2028 &&
                           today.getMonth() === 3 &&
                           today.getDate() === 21;

    if (isApril21st2028) {
      return interaction.reply("Lucas has permanently left the building. No more excuses needed! 🎉");
    }

    const isMayFourth = today.getMonth() === 4 && today.getDate() === 4;

    await interaction.deferReply(isTestMode ? { flags: MessageFlags.Ephemeral } : {});

    // Only check for existing messages if NOT in test mode
    if (!isTestMode) {
      const existingGACMessage = await GACMessage.findOne({ where: { date: todayString } });

      if (existingGACMessage) {
        return interaction.editReply(`Lucas already made his excuse for today at ${existingGACMessage.createdAt.toLocaleString()}`);
      }
    }

    const excuse = await generateLucasExcuse(isMayFourth);

    let betResults = null;
    if (!isTestMode) {
      try {
        await GACMessage.create({
          date: todayString,
          userId: interaction.user.id,
          username: interaction.user.username,
          emojis: '',
          excuse,
        });
      }
      catch (error) {
        if (!(error instanceof UniqueConstraintError)) throw error;
        // Someone else's /gac finished while Gemini was writing ours
        return interaction.editReply('Lucas just made his excuse a moment ago — scroll up! 🏃');
      }
      betResults = await settleBets(todayString, excuse);
    }

    const mayFourthHeader = isMayFourth
      ? '\n\n*✨ May the Fourth Be With You ✨*'
      : '';
    const replyContent =
      ':regional_indicator_g::regional_indicator_a::regional_indicator_c:' +
      mayFourthHeader +
      '\n\n**Lucas:** "Hey team, I need to head out early today. ' + excuse + '"' +
      (betResults ? `\n\n${betResults}` : '') +
      (isTestMode ? '\n\n*⚠️ Test mode - not saved to database*' : '');

    return interaction.editReply(replyContent);
  },
};
