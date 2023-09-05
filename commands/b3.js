const { SlashCommandBuilder } = require('discord.js');
const { Configuration, OpenAIApi } = require('openai');
const { chatGptKey } = require('../config.json');

const configuration = new Configuration({
  apiKey: chatGptKey,
});

const openai = new OpenAIApi(configuration);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('b3')
    .setDescription('Chat with b3')
    .addStringOption(option => option
      .setName('message')
      .setDescription('Your message to chat with b3')
      .setRequired(true)),
  async execute(interaction) {
    const userMessage = interaction.options.getString('message');

	try {
		const response = await openai.createCompletion({
		  prompt: userMessage,
		  max_tokens: 50,
		  model: 'gpt-3.5-turbo',
		});
	  
		const botResponse = response.choices[0].text;
		interaction.reply(botResponse);
	  } catch (error) {
		console.error('OpenAI API Error:', error.response?.data || error.message);
		interaction.reply('An error occurred while processing your request.');
	  }
	  
  },
};
