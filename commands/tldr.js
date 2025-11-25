const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey } = require('../config.json');

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

      // Filter out bot commands and format for AI
      const relevantMessages = Array.from(messages.values())
        .reverse()
        .filter(msg => !msg.content.startsWith('/'))
        .slice(0, messageCount);

      if (relevantMessages.length === 0) {
        return interaction.editReply("No messages to summarize! Y'all been quiet 👀");
      }

      // Format conversation
      const conversationText = relevantMessages
        .map(msg => `${msg.author.username}: ${msg.content}`)
        .join('\n');

      // Create prompt for AI summary
      const prompt = `You are a witty, sarcastic Discord bot. Summarize this conversation in your signature playful, roasting style. Keep it concise (2-4 sentences) but entertaining. Point out funny moments, call out anyone being weird, and add your own commentary.

Conversation:
${conversationText}

Your snarky summary:`;

      // Generate summary
      const result = await model.generateContent(prompt);
      const summary = result.response.text().trim();

      // Add some flair
      const header = `📝 **TLDR of the last ${relevantMessages.length} messages:**\n\n`;
      
      await interaction.editReply(header + summary);

    } catch (error) {
      console.error('Error in /tldr command:', error);
      await interaction.editReply('Failed to generate summary. Maybe the conversation was too chaotic even for me 💀');
    }
  },
};