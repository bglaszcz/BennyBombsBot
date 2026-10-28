const { Events } = require('discord.js');
const { generateText, SafetyBlockError } = require('../services/gemini');
const userMemory = require('../services/userMemory');

// Configuration constants
const MAX_MESSAGE_LENGTH = 2000; // Discord's message length limit
const MAX_CONTEXT_MESSAGES = 5; // Number of previous messages to include in context
const CONVERSATION_TIMEOUT = 10 * 60 * 1000; // 10 minutes - conversations expire after this
const TYPING_INTERVAL = 5000; // 5 seconds - refresh typing indicator
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes - periodic cleanup of expired conversations

// Store conversation history with better structure
const conversations = new Map();

// Periodic cleanup to prevent memory leaks from inactive channels
setInterval(() => {
  let cleanedCount = 0;
  for (const [channelId, conv] of conversations.entries()) {
    if (conv.isExpired()) {
      conversations.delete(channelId);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedCount} expired conversation(s)`);
  }
}, CLEANUP_INTERVAL);

class Conversation {
  constructor() {
    this.messages = [];
    this.lastActivity = Date.now();
  }

  addMessage(role, content, username = null, userId = null) {
    this.messages.push({
      role,
      content,
      username,
      userId,
      timestamp: Date.now(),
    });
    this.lastActivity = Date.now();
    // Keep only recent messages within timeout
    this.messages = this.messages.filter(msg =>
      Date.now() - msg.timestamp < CONVERSATION_TIMEOUT,
    );
  }

  getContext() {
    return this.messages.slice(-MAX_CONTEXT_MESSAGES);
  }

  isExpired() {
    return Date.now() - this.lastActivity > CONVERSATION_TIMEOUT;
  }
}

function getConversation(channelId) {
  const existing = conversations.get(channelId);
  if (existing && !existing.isExpired()) return existing;

  const fresh = new Conversation();
  conversations.set(channelId, fresh);
  return fresh;
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;

    const botId = message.client.user.id;
    const isMentioned = message.mentions.users.has(botId);
    // repliedUser comes with the message payload, so no extra API call is needed
    const isReplyToBot = message.mentions.repliedUser?.id === botId;

    if (!isMentioned && !isReplyToBot) return;

    const userId = message.author.id;

    // Local to this request so overlapping pings in one channel can't leak each other's interval
    const sendTyping = () => message.channel.sendTyping().catch(() => {});
    sendTyping();
    const typingInterval = setInterval(sendTyping, TYPING_INTERVAL);

    try {
      // Get user memory ONCE and reuse throughout request (performance optimization)
      const memory = userMemory.getUserMemory(userId);

      // Update user memory - last seen and message count
      userMemory.updateLastSeen(userId, message.author.username);
      userMemory.checkAchievements(userId);

      // Clean old memories every 10 messages to keep things fresh
      if (memory.messageCount % 10 === 0) {
        userMemory.cleanOldMemories(userId);
      }

      // Get the user's nickname for consistent usage
      const userNickname = memory.nickname || message.author.username;

      const conversation = getConversation(message.channel.id);

      const userMessage = message.content
        .replace(new RegExp(`<@!?${botId}>`, 'g'), '')
        .trim();

      conversation.addMessage('user', userMessage, userNickname, userId);

      const context = conversation.getContext();
      const memoryContext = userMemory.formatMemoryForPrompt(userId);

      let response;
      try {
        response = await generateText(formatPrompt(context, message, memoryContext, userNickname));
      }
      catch (error) {
        if (!(error instanceof SafetyBlockError)) throw error;
        // Safety filter triggered — retry once with a plain, memory-free prompt
        console.warn('Chat response blocked, retrying with fallback prompt:', error.message);
        response = await generateText(formatFallbackPrompt(context, message, userNickname));
      }

      // In the background: note which memories the reply brought up (so they aren't
      // repeated) and learn new ones. Skips itself when there's nothing to do.
      userMemory.analyzeForMemories(userId, userNickname, userMessage, response)
        .catch(err => console.error('Background memory analysis failed:', err));

      conversation.addMessage('assistant', response, 'Assistant');

      clearInterval(typingInterval);
      for (const chunk of splitTextIntoChunks(response)) {
        await message.reply(chunk);
      }
    }
    catch (error) {
      console.error('Error in message handling:', error);

      const errorMessage = error instanceof SafetyBlockError
        ? "I can't process that request, but I'm happy to chat about something else! 😊"
        : 'Sorry, I encountered an error while processing your message.';

      await message.reply(errorMessage).catch(() => {});
    }
    finally {
      clearInterval(typingInterval);
    }
  },
};

function formatPrompt(context, message, memoryContext, userNickname) {
  const systemPrompt = `
Your personality:
- You're a chill, friendly presence who genuinely enjoys hanging out and chatting
- You have a sharp wit and CAN roast or be sarcastic, but you don't lead with it
- Most of the time you're easygoing, helpful, and conversational
- If someone trash talks or roasts you, THEN you fire back with creative comebacks
- Mix in pop culture references when they fit
- Can self-deprecate and take a joke
- Use emojis and internet slang naturally

Style guide:
- Default to a natural, relaxed conversational tone
- Keep responses concise for chat (2-5 sentences typically, unless the topic calls for more)
- Only bring out the sarcasm and trash talk when the other person starts it or the vibe calls for it
- Be clever and witty, but not always at someone's expense
- Read the room - match users' energy (chill if they're chill, spicy if they're spicy)
- Reference users by their nickname when it makes sense
- Treat what you remember about users as background. Only use it when it's relevant to what they're saying right now
- At most one callback to a memory per reply, and never one labeled "already brought up"
- Don't repeat a point, joke, or reference you already made earlier in this conversation
- NEVER mention achievements, message counts, or how long you've known someone unless the user asks

Current context:
- Server: ${message.guild?.name || 'DM'}
- Channel: ${message.channel.name || 'DM'}
- Current user: ${userNickname}

What you remember about this user:
${memoryContext}

Remember:
- No hate speech or discriminatory comments; deflect such remarks without repeating the content
- If someone's genuinely upset, drop the jokes and be supportive and kind
- Back off if someone's not into it

Previous conversation:`;

  const contextMessages = context
    .map(msg => `${msg.username || (msg.role === 'user' ? 'User' : 'Assistant')}: ${msg.content}`)
    .join('\n');

  return `${systemPrompt}\n\n${contextMessages}`;
}

function formatFallbackPrompt(context, message, userNickname) {
  const systemPrompt = `You are a helpful Discord chat assistant. Please respond to the conversation in a friendly and appropriate way, focusing on being helpful and clear.

Current context:
- Server: ${message.guild?.name || 'DM'}
- Current user: ${userNickname}

Previous conversation:`;

  const contextMessages = context
    .map(msg => `${msg.username || (msg.role === 'user' ? 'User' : 'Assistant')}: ${msg.content}`)
    .join('\n');

  return `${systemPrompt}\n\n${contextMessages}`;
}

function splitTextIntoChunks(text, maxLength = MAX_MESSAGE_LENGTH) {
  if (text.length <= maxLength) return [text];

  const chunks = [];
  let currentChunk = '';
  const sentences = text.split(/(?<=[.!?])\s+/);

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      continue;
    }
    if (currentChunk) chunks.push(currentChunk);

    // A single "sentence" longer than the limit (code, lists, no punctuation) gets hard-split
    let remaining = sentence;
    while (remaining.length > maxLength) {
      chunks.push(remaining.slice(0, maxLength));
      remaining = remaining.slice(maxLength);
    }
    currentChunk = remaining;
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}
