const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');  // Corrected package import
require('dotenv').config();  // Ensure your .env file is loaded
const { geminiApiKey, geminiModel } = require('../config.json');

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(geminiApiKey);  // Make sure API_KEY is in your .env file
const model = genAI.getGenerativeModel({ model: geminiModel });

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test')
        .setDescription('A basic test command to troubleshoot unknown integration'),
    async execute(interaction) {
        try {
            const prompt = "Write a story about a magic backpack that is under 2000 characters.";  // Example prompt

            // Call the model to generate content
            const result = await model.generateContent(prompt);
            
            // Log the result for debugging
            console.log(result.response.text());  

            // Send the generated content as a reply to the Discord interaction
            await interaction.reply(result.response.text());
        } catch (error) {
            console.error('Error handling /test command:', error);
            await interaction.reply({ content: 'Failed to execute /test command.', ephemeral: true });
        }
    },
};
