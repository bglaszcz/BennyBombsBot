const { Events } = require('discord.js');
const OpenAI = require('openai');
const { chatGptKey, botId } = require('../config.json');
const Sequelize = require('sequelize');
const sequelize = require('../db.js');

const OpenAIAPIUsage = require('../models/OpenAIAPIUsage')(sequelize, Sequelize.DataTypes);

const openai = new OpenAI({
    apiKey: chatGptKey,
});

const MAX_MESSAGE_LENGTH = 2000; // Discord's maximum message length
const MAX_CONTEXT_MESSAGES = 3; // Number of previous messages to use as context
const CONVERSATION_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds
const CONVERSATION_TIMEOUT_CHECK_INTERVAL = 10 * 60 * 1000; // Check every 10 minutes

// Map to store conversation history
const conversationHistory = new Map();

// Clear conversations that have been inactive for 10 minutes
setInterval(() => {
    const now = Date.now();
    conversationHistory.forEach((conversation, userId) => {
        const lastActivityTime = conversation[conversation.length - 1].timestamp;
        if (now - lastActivityTime > CONVERSATION_TIMEOUT) {
            conversationHistory.delete(userId);
        }
    });
}, CONVERSATION_TIMEOUT_CHECK_INTERVAL);

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        if (message.author.bot) return;

        try {
            await OpenAIAPIUsage.create({
                username: interaction.user.username,
                type: 'chat',
            });
          }
          catch (error) {
              console.log(error);
          }

        // Check if the message is a reply
        if (message.reference) {
            return;
        }

        const botMention = message.mentions.users.find(user => user.id === botId);
        if (botMention) {
            const userMessage = message.content.replace(`<@!${botMention.id}>`, '').trim();

            try {
                // Send a typing indicator to indicate the bot is typing
                message.channel.sendTyping();

                // Fetch the last 5 messages in the channel as context
                const contextMessages = await message.channel.messages.fetch({ limit: MAX_CONTEXT_MESSAGES });

                // Create an array to hold the context messages' content with roles
                const context = [];

                // Reverse the order of context messages to match the actual conversation
                const reversedContextMessages = [...contextMessages.values()].reverse();

                reversedContextMessages.forEach(msg => {
                    if (msg.author.id === botId) {
                        context.push({ role: 'assistant', content: msg.content });
                    } else if (msg.author.id !== message.author.id) {
                        context.push({ role: 'user', content: msg.content });
                    }
                });

                // Add the user's message to the context if it's not a duplicate
                if (!context.some(item => item.role === 'user' && item.content === userMessage)) {
                    context.push({ role: 'user', content: userMessage });
                }

                // Store the conversation in history with the user's ID as the key
                conversationHistory.set(message.author.id, context);

                // Log the formatted context to the console
                // console.log('Formatted Context:', context);

                // Send the user's message along with the context to the AI
                const response = await openai.chat.completions.create({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: 'system',
                            content: 'This chatbot personality is armed with a quiver of clever quips, perplexing riddles, dry humor sharper than a razor, quick wit, and a knack for unraveling the most profound of questions. It can engage your group with humor, trivia, and playful banter, enhancing the overall fun of your Discord chats.',
                        },
                        ...context // Include the context as previous messages
                    ],
                    max_tokens: 100,
                });

                if (response.choices && response.choices.length > 0) {
                    const botResponse = response.choices[0].message.content;

                    // Split the response into chunks that fit within Discord's character limit
                    const chunks = splitTextIntoChunks(botResponse, MAX_MESSAGE_LENGTH);

                    // Send each chunk as a separate message
                    for (const chunk of chunks) {
                        message.channel.send(chunk);
                    }
                } else {
                    message.channel.send('Received an empty response from the AI.');
                }
            } catch (error) {
                console.error('OpenAI API Error:', error.response?.data || error.message);
                message.channel.send('An error occurred while processing your request.');
            }
        }
    },
};

// Function to split text into chunks that fit within the specified length
function splitTextIntoChunks(text, chunkLength) {
    const chunks = [];
    for (let i = 0; i < text.length; i += chunkLength) {
        chunks.push(text.slice(i, i + chunkLength));
    }
    return chunks;
}
