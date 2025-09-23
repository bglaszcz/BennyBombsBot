const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey } = require('../config.json');

const { Sequelize } = require('sequelize');
const sequelize = require('../db.js');

// You'll need to create this model - see below for the model definition
const GACMessage = require('../models/GACMessage')(sequelize, Sequelize.DataTypes);

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", temperature: 0.9 });

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
Generate a single, creative excuse for why you need to leave work early today. The excuse should be:
- Believable but slightly absurd
- Professional in tone but with underlying ridiculousness
- Between 20-80 words
- Something that would make coworkers roll their eyes
- Not involving serious emergencies or health issues
- Do not repeat themes from previous excuses

Here are the last 5 excuses that have already been used. DO NOT reuse or be too similar to these:
${previousExcuses || "(none yet)"}

Explore a wide range of categories: pets, smart home devices, obscure community rules, minor bureaucratic crises, neighbors’ antics, vehicle oddities, or delivery mishaps.

Generate only the excuse, no extra text or quotation marks.`;

    const result = await model.generateContent(prompt);
    return result.response.text().trim();

  } catch (error) {
    console.error('Error generating Lucas excuse:', error);

    // Fallback excuses in case AI fails
    const fallbackExcuses = [
      "I need to supervise the installation of my new smart doorbell because the manual is in Swedish and I'm the only one who speaks Swedish in a 3-mile radius.",
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
    const todayString = today.toLocaleDateString(); // For database comparison
    const currentHour = today.getHours(); // Get current hour (0-23)
    const mode = interaction.options.getString('mode') || 'normal';
    const isTestMode = mode === 'test';
    
    // Debug: Log what we're getting
    console.log('GAC Debug:', {
      mode,
      isTestMode,
      allOptions: interaction.options.data,
      currentHour,
      todayString
    });
    
    // Check if current time is between 12pm (12) and 4pm (16) - skip in test mode
    if (!isTestMode && (currentHour < 12 || currentHour >= 16)) {
      return interaction.reply("GAC can only be used between 12pm and 4pm! Lucas doesn't make excuses outside of afternoon hours. ⏰");
    }
    
    // Check if today is April 21st, 2028 (matching your GMC special date pattern)
    const isApril21st2028 = today.getFullYear() === 2028 && 
                           today.getMonth() === 3 && // Months are 0-indexed (0 = January, 3 = April)
                           today.getDate() === 21;
    
    if (isApril21st2028) {
      // Return the special message on April 21st, 2028
      return interaction.reply("Lucas has permanently left the building. No more excuses needed! 🎉");
    }
    
    // Regular GAC command logic for other days
    try {
      // Defer reply since AI generation might take time
      await interaction.deferReply();

      const existingGACMessage = await GACMessage.findOne({
        where: { date: todayString },
      });

      if (!isTestMode && existingGACMessage) {
        const existingCreatedAt = existingGACMessage.createdAt.toLocaleString();
        const replyContent = `Lucas already made his excuse for today at ${existingCreatedAt}`;
        return interaction.editReply(replyContent);
      } else {
        // Generate Lucas's excuse
        const excuse = await generateLucasExcuse();

        // Create a new GACMessage in the database (skip in test mode)
        if (!isTestMode) {
          await GACMessage.create({
            date: todayString,
            username: interaction.user.username,
            emojis: '', // No emojis needed, but keeping field for consistency
            excuse: excuse
          });
        }

        const replyContent = 
          ':regional_indicator_g::regional_indicator_a::regional_indicator_c:' +
          '\n\n**Lucas:** "Hey team, I need to head out early today. ' + excuse + '"' +
          (isTestMode ? '\n\n*⚠️ Test mode - not saved to database*' : '');

        // Send the reply
        return interaction.editReply(replyContent);
      }
    } catch (error) {
      console.error('Error in GAC command:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return interaction.editReply(`An error occurred while generating Lucas's excuse. He'll have to stay late today! 😅\n\n*Debug: ${error.message}*`);
    }
  },
};