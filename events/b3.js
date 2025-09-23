const { Events } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey, botId } = require('../config.json');

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(geminiApiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_MESSAGES = 5;
const CONVERSATION_TIMEOUT = 10 * 60 * 1000; // 10 minutes
const TYPING_INTERVAL = 5000; // 5 seconds typing indicator refresh

// Store conversation history with better structure
const conversations = new Map();

class Conversation {
  constructor() {
    this.messages = [];
    this.lastActivity = Date.now();
    this.typingInterval = null;
  }

  addMessage(role, content) {
    this.messages.push({ role, content, timestamp: Date.now() });
    this.lastActivity = Date.now();
    // Keep only recent messages within timeout
    this.messages = this.messages.filter(msg => 
      Date.now() - msg.timestamp < CONVERSATION_TIMEOUT
    );
  }

  getContext() {
    return this.messages.slice(-MAX_CONTEXT_MESSAGES);
  }

  isExpired() {
    return Date.now() - this.lastActivity > CONVERSATION_TIMEOUT;
  }

  // Add method to safely clear typing
  clearTyping() {
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = null;
    }
  }
}

async function generateSafeResponse(model, prompt, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      if (i === retries - 1) throw error; // Throw on last retry
      console.log(`Retry ${i + 1} after error:`, error.message);
      // Short delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    // Check if message mentions the bot or is a reply to the bot
    const isMentioned = message.mentions.users.has(botId);
    const isReplyToBot = message.reference && 
      (await message.channel.messages.fetch(message.reference.messageId))
        .author.id === botId;

    if (!isMentioned && !isReplyToBot) return;

    const channelId = message.channel.id;
    let conversation = null;
    
    try {
      // Maintain typing indicator
      const maintainTyping = async () => {
        try {
          await message.channel.sendTyping();
        } catch (error) {
          console.error('Error sending typing indicator:', error);
        }
      };

      // Get or create conversation
      if (!conversations.has(channelId)) {
        conversations.set(channelId, new Conversation());
      }
      conversation = conversations.get(channelId);

      // Clean expired conversations
      if (conversation.isExpired()) {
        conversation.clearTyping(); // Clear any existing typing
        conversations.delete(channelId);
        conversations.set(channelId, new Conversation());
        conversation = conversations.get(channelId);
      }

      // Start typing indicator
      maintainTyping();
      conversation.typingInterval = setInterval(maintainTyping, TYPING_INTERVAL);

      // Clean user message
      const userMessage = message.content
        .replace(new RegExp(`<@!?${botId}>`, 'g'), '')
        .trim();

      // Add message to conversation
      conversation.addMessage('user', userMessage);

      // Prepare prompt with conversation context
      const context = conversation.getContext();
      const prompt = formatPrompt(context);

      // Generate response with retries
      let response;
      try {
        response = await generateSafeResponse(model, prompt);
      } catch (error) {
        console.error('Generation error:', error);
        // If safety filter triggered, try with fallback prompt
        if (error.message?.includes('SAFETY')) {
          const fallbackPrompt = formatFallbackPrompt(context);
          response = await generateSafeResponse(model, fallbackPrompt);
        } else {
          throw error; // Re-throw other errors
        }
      }

      // Clear typing indicator BEFORE sending response
      conversation.clearTyping();

      // Add bot's response to conversation history
      conversation.addMessage('assistant', response);

      // Send response in chunks if needed
      const chunks = splitTextIntoChunks(response);
      for (const chunk of chunks) {
        await message.reply(chunk);
      }

    } catch (error) {
      console.error('Error in message handling:', error);
      
      // Always clear typing indicator on error
      if (conversation) {
        conversation.clearTyping();
      }
      
      let errorMessage = 'Sorry, I encountered an error while processing your message.';
      if (error.message?.includes('SAFETY')) {
        errorMessage = "I can't process that request, but I'm happy to chat about something else! 😊";
      }
      
      try {
        await message.reply(errorMessage);
      } catch (replyError) {
        console.error('Error sending error message:', replyError);
      }
    }
  },
};

function formatPrompt(context) {
  const systemPrompt = `
  Your personality:
- Drop creative roasts and witty comebacks
- Use playful sarcasm and clever wordplay
- Mix in pop culture references when they fit
- Give as good as you get - if someone trash talks, fire back
- Keep it fun and playful, never actually mean-spirited
- Can self-deprecate and take a joke
- Use emojis and internet slang naturally

Style guide:
- Short, punchy responses with attitude
- Mix in some mild trash talk when appropriate
- Be quick-witted and a bit cocky
- Read the room - match users' energy
- If someone's genuinely upset, drop the attitude and be cool

Remember:
- Keep it fun and light
- No hate speech or discriminatory comments
- Back off if someone's not into it

Previous conversation:`;

  const contextMessages = context
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  return `${systemPrompt}\n\n${contextMessages}`;
}

function formatFallbackPrompt(context) {
  const systemPrompt = `You are a helpful Discord chat assistant. Please respond to the conversation in a friendly and appropriate way, focusing on being helpful and clear.

Previous conversation:`;

  const contextMessages = context
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  return `${systemPrompt}\n\n${contextMessages}`;
}

function splitTextIntoChunks(text, maxLength = MAX_MESSAGE_LENGTH) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let currentChunk = '';
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = sentence;
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}