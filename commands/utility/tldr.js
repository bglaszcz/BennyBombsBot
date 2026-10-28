const { SlashCommandBuilder } = require('discord.js');
const { generateText } = require('../../services/gemini');
const { getNickname } = require('../../utils/getNickname');

module.exports = {
  cooldown: 30,
  data: new SlashCommandBuilder()
    .setName('tldr')
    .setDescription('Get a snarky summary of recent conversation')
    .addIntegerOption(option =>
      option
        .setName('messages')
        .setDescription('Number of messages to summarize (default: 50)')
        .setMinValue(10)
        .setMaxValue(100)
        .setRequired(false),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const messageCount = interaction.options.getInteger('messages') || 50;
      const messages = await interaction.channel.messages.fetch({ limit: messageCount });

      // Oldest first, skipping bot output and empty (attachment-only) messages
      const relevantMessages = [...messages.values()]
        .reverse()
        .filter(msg => !msg.author.bot && msg.content && !msg.content.startsWith('/'));

      if (relevantMessages.length === 0) {
        return interaction.editReply("No messages to summarize! Y'all been quiet 👀");
      }

      const conversationText = relevantMessages
        .map(msg => `${getNickname(msg.author.id, msg.author.username)}: ${msg.content}`)
        .join('\n');

      const prompt = `You are a witty, sarcastic Discord bot. Summarize this conversation in your signature playful, roasting style. Keep it concise (2-4 sentences) but entertaining. Point out funny moments, call out anyone being weird, and add your own commentary.

Use the names exactly as they appear in the conversation (these are the users' preferred nicknames).

Conversation:
${conversationText}

Your TLDR summary:`;

      const summary = await generateText(prompt);
      const finalSummary = summary.length > 1900 ? `${summary.substring(0, 1900)}...` : summary;

      await interaction.editReply(`📝 **TLDR** (last ${relevantMessages.length} messages):\n\n${finalSummary}`);
    }
    catch (error) {
      console.error('TLDR command error:', error);
      await interaction.editReply("Something broke while trying to summarize. Probably your fault. 🙄");
    }
  },
};
