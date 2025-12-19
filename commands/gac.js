const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey, geminiModel } = require('../config.json');

const { Sequelize } = require('sequelize');
const sequelize = require('../db.js');

const GACMessage = require('../models/GACMessage')(sequelize, Sequelize.DataTypes);

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: geminiModel });

async function generateLucasExcuse() {
  try {
    // Get last 5 excuses from database
    const lastExcuses = await GACMessage.findAll({
      limit: 5,
      order: [['createdAt', 'DESC']],
      attributes: ['excuse']
    });

    const previousExcuses = lastExcuses.map(e => `- ${e.excuse}`).join("\n");

    const prompt = `You are Lucas, a middle manager in IT who needs to leave work early. 
Generate a single, creative excuse for why you need to leave work early today.

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

Explore a wide range of categories: pets, smart home devices, obscure community rules, minor bureaucratic crises, neighbors' antics, vehicle oddities, or delivery mishaps.

EXAMPLES of correct format (notice they start directly with the situation):
- "My neighbor's cat got stuck in my car's exhaust pipe and I'm the only one with the right tools to extract it safely."
- "The artisanal honey I ordered from that obscure beekeeping collective is being delivered during a very specific window, and it requires immediate refrigeration to preserve its delicate floral notes."
- "My robotic lawnmower is currently attempting to engage the neighbor's prize-winning poodle in a turf war and I need to intervene before animal control becomes involved."

Generate only the excuse reason itself - no extra text, quotation marks, or leaving/departing phrases.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();

  } catch (error) {
    console.error('Error generating Lucas excuse:', error);

    // Fallback excuses in case AI fails
    const fallbackExcuses = [
      "My new smart doorbell's installation manual is in Swedish and I'm the only one who speaks Swedish in a 3-mile radius.",
      "My HOA is having an emergency meeting about whether the Johnson's garden gnome is 0.3 inches too tall and violates community standards.",
      "I accidentally ordered 200 pounds of quinoa instead of 2 pounds and need to figure out what to do with it before it expires.",
      "My cat learned how to open doors and has been letting all the neighborhood cats into my house for what appears to be some sort of feline summit."
    ];
    return fallbackExcuses[Math.floor(Math.random() * fallbackExcuses.length)];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('gac')
    .setDescription('Lucas needs to leave work early again...')
    .addStringOption(option =>
      option.setName('mode')
        .setDescription('Run in test mode')
        .addChoices(
          { name: 'Normal', value: 'normal' },
          { name: 'Test', value: 'test' }
        )
        .setRequired(false)),
  
  async execute(interaction) {
    const today = new Date();
    const todayString = today.toLocaleDateString();
    const currentHour = today.getHours();
    const mode = interaction.options.getString('mode') || 'normal';
    const isTestMode = mode === 'test';
    
    // Debug logging
    console.log('GAC Debug:', {
      mode,
      isTestMode,
      allOptions: interaction.options.data,
      currentHour,
      todayString
    });
    
    // Check if current time is between 12pm and 4pm (skip in test mode)
    if (!isTestMode && (currentHour < 12 || currentHour >= 16)) {
      return interaction.reply("GAC can only be used between 12pm and 4pm! Lucas doesn't make excuses outside of afternoon hours. ⏰");
    }
    
    // Check for special date
    const isApril21st2028 = today.getFullYear() === 2028 && 
                           today.getMonth() === 3 && 
                           today.getDate() === 21;
    
    if (isApril21st2028) {
      return interaction.reply("Lucas has permanently left the building. No more excuses needed! 🎉");
    }
    
    // Main GAC command logic
    try {
      await interaction.deferReply();

      // Only check for existing messages if NOT in test mode
      if (!isTestMode) {
        const existingGACMessage = await GACMessage.findOne({
          where: { date: todayString }
        });

        if (existingGACMessage) {
          const existingCreatedAt = existingGACMessage.createdAt.toLocaleString();
          const replyContent = `Lucas already made his excuse for today at ${existingCreatedAt}`;
          return interaction.editReply(replyContent);
        }
      }

      // Generate Lucas's excuse
      const excuse = await generateLucasExcuse();

      // Create a new GACMessage in the database (skip in test mode)
      if (!isTestMode) {
        await GACMessage.create({
          date: todayString,
          username: interaction.user.username,
          emojis: '',
          excuse: excuse
        });
      }

      // Build the reply message
      const replyContent = 
        ':regional_indicator_g::regional_indicator_a::regional_indicator_c:' +
        '\n\n**Lucas:** "Hey team, I need to head out early today. ' + excuse + '"' +
        (isTestMode ? '\n\n*⚠️ Test mode - not saved to database*' : '');

      return interaction.editReply(replyContent);

    } catch (error) {
      console.error('Error in GAC command:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return interaction.editReply(`An error occurred while generating Lucas's excuse. He'll have to stay late today! 😅\n\n*Debug: ${error.message}*`);
    }
  }
};