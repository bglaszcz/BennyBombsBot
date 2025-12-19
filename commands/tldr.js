const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey, geminiModel } = require('../config.json');
const fs = require('fs');
const path = require('path');

const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: geminiModel });

// Load userMemories to get nicknames
function getUserNickname(userId, username) {
  try {
    const memoriesPath = path.join(__dirname, '..', 'userMemories.json');
    if (fs.existsSync(memoriesPath)) {
      const memories = JSON.parse(fs.readFileSync(memoriesPath, 'utf8'));
      if (memories[userId] && memories[userId].nickname) {
        return memories[userId].nickname;
      }
    }
  } catch (err) {
    console.error('Error loading userMemories for nickname:', err);
  }
  return username; // fallback to Discord username
}

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

      // Format conversation using nicknames from userMemories
      const conversationText = relevantMessages
        .map(msg => {
          const displayName = getUserNickname(msg.author.id, msg.author.username);
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