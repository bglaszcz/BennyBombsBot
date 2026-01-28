const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey, geminiModel, botId } = require('../../config.json');
const { getNickname } = require('../../utils/getNickname');

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: geminiModel });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tldr')
    .setDescription('Get a snarky summary of recent conversation')
    .addIntegerOption(option =>
      option
        .setName('messages')
        .setDescription('Number of messages to summarize (default: 50)')
        .setMinValue(10)
        .setMaxValue(100)
        .setRequired(false)
    ),
  
  async execute(interaction) {
    await interaction.deferReply();

    try {
      const messageCount = interaction.options.getInteger('messages') || 50;
      
      // Fetch recent messages
      const messages = await interaction.channel.messages.fetch({ 
        limit: Math.min(messageCount, 100) 
      });

      // Filter out bot commands and bot messages
      const relevantMessages = Array.from(messages.values())
        .reverse()
        .filter(msg => !msg.content.startsWith('/') && msg.author.id !== botId)
        .slice(0, messageCount);

      if (relevantMessages.length === 0) {
        return interaction.editReply("No messages to summarize! Y'all been quiet 👀");
      }

      // Format conversation using nicknames from userMemories (with caching)
      const conversationText = relevantMessages
        .map(msg => {
          const displayName = getNickname(msg.author.id, msg.author.username);
          return `${displayName}: ${msg.content}`;
        })
        .join('\n');

      // Create prompt for AI summary
      const prompt = `You are a witty, sarcastic Discord bot. Summarize this conversation in your signature playful, roasting style. Keep it concise (2-4 sentences) but entertaining. Point out funny moments, call out anyone being weird, and add your own commentary.

Use the names exactly as they appear in the conversation (these are the users' preferred nicknames).

Conversation:
${conversationText}

Your TLDR summary:`;

      const result = await model.generateContent(prompt);
      const summary = result.response.text().trim();

      // Truncate if needed (Discord limit is 2000 chars)
      const finalSummary = summary.length > 1900 
        ? summary.substring(0, 1900) + '...' 
        : summary;

      await interaction.editReply(`📝 **TLDR** (last ${relevantMessages.length} messages):\n\n${finalSummary}`);

    } catch (error) {
      console.error('TLDR command error:', error);
      await interaction.editReply("Something broke while trying to summarize. Probably your fault. 🙄");
    }
  },
};