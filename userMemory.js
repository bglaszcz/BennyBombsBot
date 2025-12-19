const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey, geminiModel } = require('./config.json');

const MEMORY_FILE = path.join(__dirname, 'userMemories.json');
const genAI = new GoogleGenerativeAI(geminiApiKey);
const memoryModel = genAI.getGenerativeModel({ model: geminiModel });

// Load memories from file
function loadMemories() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading memories:', error);
  }
  return {};
}

// Save memories to file
function saveMemories(memories) {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2));
  } catch (error) {
    console.error('Error saving memories:', error);
  }
}

let memories = loadMemories();

// Get or create user memory
function getUserMemory(userId) {
  if (!memories[userId]) {
    memories[userId] = {
      username: null,
      nickname: null, // Manual override for what to call this person
      facts: [],
      preferences: {},
      insideJokes: [],
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      messageCount: 0,
      roastScore: 0,
      achievements: []
    };
    saveMemories(memories);
  }
  return memories[userId];
}

// Update last seen
function updateLastSeen(userId, username) {
  const memory = getUserMemory(userId);
  memory.username = username;
  
  // Set nickname to username if not already set
  if (!memory.nickname) {
    memory.nickname = username;
  }
  
  memory.lastSeen = new Date().toISOString();
  memory.messageCount++;
  saveMemories(memories);
}

// Add fact with timestamp
function addFact(userId, fact) {
  const memory = getUserMemory(userId);
  
  // Check if fact already exists (compare the text content)
  const existingFact = memory.facts.find(f => 
    (typeof f === 'string' ? f : f.text) === fact
  );
  
  if (!existingFact) {
    memory.facts.push({
      text: fact,
      addedOn: new Date().toISOString(),
      lastReferenced: new Date().toISOString()
    });
    saveMemories(memories);
    console.log(`📝 New fact learned about ${memory.username}: ${fact}`);
  } else if (typeof existingFact === 'object') {
    // Update lastReferenced if it already exists
    existingFact.lastReferenced = new Date().toISOString();
    saveMemories(memories);
  }
}

// Add preference with timestamp
function addPreference(userId, category, value) {
  const memory = getUserMemory(userId);
  memory.preferences[category] = {
    value: value,
    addedOn: new Date().toISOString(),
    lastReferenced: new Date().toISOString()
  };
  saveMemories(memories);
  console.log(`❤️ New preference for ${memory.username}: ${category} = ${value}`);
}

// Add inside joke with timestamp
function addInsideJoke(userId, joke) {
  const memory = getUserMemory(userId);
  
  // Check if joke already exists (compare the text content)
  const existingJoke = memory.insideJokes.find(j => 
    (typeof j === 'string' ? j : j.text) === joke
  );
  
  if (!existingJoke) {
    memory.insideJokes.push({
      text: joke,
      addedOn: new Date().toISOString(),
      lastReferenced: new Date().toISOString()
    });
    saveMemories(memories);
    console.log(`😂 New inside joke with ${memory.username}: ${joke}`);
  } else if (typeof existingJoke === 'object') {
    // Update lastReferenced if it already exists
    existingJoke.lastReferenced = new Date().toISOString();
    saveMemories(memories);
  }
}

// Add achievement
function addAchievement(userId, achievementName) {
  const memory = getUserMemory(userId);
  const hasAchievement = memory.achievements.some(a => a.name === achievementName);
  
  if (!hasAchievement) {
    memory.achievements.push({
      name: achievementName,
      earnedOn: new Date().toISOString()
    });
    saveMemories(memories);
    console.log(`🏆 ${memory.username} earned: ${achievementName}`);
  }
}

// Update roast score
function updateRoastScore(userId, change) {
  const memory = getUserMemory(userId);
  memory.roastScore += change;
  saveMemories(memories);
  
  // Check for roast-related achievements
  if (memory.roastScore >= 10) {
    addAchievement(userId, 'Roast Master');
  }
  if (memory.roastScore <= -10) {
    addAchievement(userId, 'Can\'t Take the Heat');
  }
}

// AI-powered memory analysis
async function analyzeForMemories(userId, username, userMessage, botResponse) {
  try {
    const analysisPrompt = `Analyze this Discord conversation and extract any memorable information about the user.

User: ${username}
User's message: "${userMessage}"
Bot's response: "${botResponse}"

Extract ONLY clear, factual information in the following categories:

1. **Facts**: Personal information they explicitly stated (job, location, hobbies, life events, etc.)
   - Example: "I'm a software engineer" → fact: "is a software engineer"
   - Example: "I live in Seattle" → fact: "lives in Seattle"
   - Example: "I just got a dog" → fact: "recently got a dog"

2. **Preferences**: Things they like/dislike, opinions, or preferences
   - Example: "I love Python" → preference: {"topic": "programming language", "value": "loves Python"}
   - Example: "I hate mornings" → preference: {"topic": "morning person", "value": "hates mornings"}

3. **Inside Jokes**: Recurring jokes, memes, or funny references specific to this conversation
   - Only include if it's genuinely a joke/reference that could be brought up again
   - Example: If they made a funny typo or running gag

4. **Roast Context**: Did the user ask to be roasted or engage in trash talk?
   - Return "roast_requested" if they explicitly asked for a roast
   - Return "trash_talk" if they engaged in playful banter

Return your analysis in this EXACT JSON format (or empty arrays/objects if nothing found):
{
  "facts": ["fact 1", "fact 2"],
  "preferences": [
    {"category": "topic name", "value": "their preference"}
  ],
  "insideJokes": ["joke reference"],
  "roastContext": "roast_requested" | "trash_talk" | null
}

IMPORTANT RULES:
- Only extract information that is CLEARLY stated or strongly implied
- Don't make assumptions or inferences
- Keep facts concise and specific
- Only include inside jokes if they're genuinely memorable
- Return empty arrays if nothing found
- MUST return valid JSON only, no other text`;

    const result = await memoryModel.generateContent(analysisPrompt);
    const responseText = result.response.text().trim();
    
    // Extract JSON from response (in case AI adds extra text)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No valid JSON found in AI response');
      return;
    }
    
    const analysis = JSON.parse(jsonMatch[0]);
    
    // Process extracted information
    if (analysis.facts && analysis.facts.length > 0) {
      analysis.facts.forEach(fact => addFact(userId, fact));
    }
    
    if (analysis.preferences && analysis.preferences.length > 0) {
      analysis.preferences.forEach(pref => {
        addPreference(userId, pref.category, pref.value);
      });
    }
    
    if (analysis.insideJokes && analysis.insideJokes.length > 0) {
      analysis.insideJokes.forEach(joke => addInsideJoke(userId, joke));
    }
    
    if (analysis.roastContext === 'roast_requested') {
      updateRoastScore(userId, 1);
    } else if (analysis.roastContext === 'trash_talk') {
      updateRoastScore(userId, 0.5);
    }
    
  } catch (error) {
    console.error('Error analyzing conversation for memories:', error);
    // Don't throw - memory extraction failing shouldn't break the bot
  }
}

// Format memory for prompt context
function formatMemoryForPrompt(userId) {
  const memory = getUserMemory(userId);
  const displayName = memory.nickname || memory.username;
  
  let context = `User: ${displayName}\n`;
  context += `Messages sent: ${memory.messageCount}\n`;
  context += `Known since: ${new Date(memory.firstSeen).toLocaleDateString()}\n`;
  
  if (memory.facts.length > 0) {
    context += `\nThings I know about them:\n`;
    memory.facts.forEach(fact => {
      const factText = typeof fact === 'string' ? fact : fact.text;
      context += `- ${factText}\n`;
      
      // Update lastReferenced when included in prompt
      if (typeof fact === 'object') {
        fact.lastReferenced = new Date().toISOString();
      }
    });
  }
  
  if (Object.keys(memory.preferences).length > 0) {
    context += `\nTheir preferences:\n`;
    Object.entries(memory.preferences).forEach(([key, pref]) => {
      const prefValue = typeof pref === 'string' ? pref : pref.value;
      context += `- ${key}: ${prefValue}\n`;
      
      // Update lastReferenced when included in prompt
      if (typeof pref === 'object') {
        pref.lastReferenced = new Date().toISOString();
      }
    });
  }
  
  if (memory.insideJokes.length > 0) {
    context += `\nInside jokes we share:\n`;
    memory.insideJokes.forEach(joke => {
      const jokeText = typeof joke === 'string' ? joke : joke.text;
      context += `- ${jokeText}\n`;
      
      // Update lastReferenced when included in prompt
      if (typeof joke === 'object') {
        joke.lastReferenced = new Date().toISOString();
      }
    });
  }
  
  if (memory.roastScore !== 0) {
    context += `\nRoast engagement: ${memory.roastScore > 0 ? 'Loves the banter' : 'Sensitive to roasts'}\n`;
  }
  
  // Save the updated lastReferenced timestamps
  saveMemories(memories);
  
  return context;
}

// Get memory summary for /memory command
function getMemorySummary(userId) {
  const memory = getUserMemory(userId);
  const daysSinceFirstSeen = Math.floor(
    (Date.now() - new Date(memory.firstSeen)) / (1000 * 60 * 60 * 24)
  );
  
  // Convert to display format (extract text from objects)
  const displayFacts = memory.facts.map(f => typeof f === 'string' ? f : f.text);
  const displayPreferences = {};
  Object.entries(memory.preferences).forEach(([key, pref]) => {
    displayPreferences[key] = typeof pref === 'string' ? pref : pref.value;
  });
  const displayJokes = memory.insideJokes.map(j => typeof j === 'string' ? j : j.text);
  
  return {
    username: memory.username,
    facts: displayFacts,
    preferences: displayPreferences,
    insideJokes: displayJokes,
    messageCount: memory.messageCount,
    roastScore: memory.roastScore,
    achievements: memory.achievements,
    daysSinceFirstSeen
  };
}

// Check for achievements
function checkAchievements(userId) {
  const memory = getUserMemory(userId);
  
  // Night owl achievement (after 2am, but only grant once)
  const hour = new Date().getHours();
  if (hour >= 2 && hour < 6) {
    addAchievement(userId, 'Night Owl');
  }
  
  // Conversation milestones
  if (memory.messageCount === 50) {
    addAchievement(userId, 'Conversation Master');
  }
  
  if (memory.messageCount === 100) {
    addAchievement(userId, 'Chatty Cathy');
  }
  
  if (memory.messageCount === 500) {
    addAchievement(userId, 'Server Regular');
  }
}

// Manually set a nickname for a user
function setNickname(userId, nickname) {
  const memory = getUserMemory(userId);
  memory.nickname = nickname;
  saveMemories(memories);
  console.log(`✏️ Set nickname for ${memory.username}: ${nickname}`);
  return memory;
}

// Clean old memories based on age and usage
function cleanOldMemories(userId) {
  const memory = getUserMemory(userId);
  const now = Date.now();
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const MAX_FACTS = 10;
  const MAX_PREFERENCES = 8;
  const MAX_INSIDE_JOKES = 5;
  
  let cleaned = false;

  // Migrate old string-based facts to new format
  memory.facts = memory.facts.map(f => {
    if (typeof f === 'string') {
      return {
        text: f,
        addedOn: new Date().toISOString(),
        lastReferenced: new Date().toISOString()
      };
    }
    return f;
  });

  // Migrate old string-based inside jokes
  memory.insideJokes = memory.insideJokes.map(j => {
    if (typeof j === 'string') {
      return {
        text: j,
        addedOn: new Date().toISOString(),
        lastReferenced: new Date().toISOString()
      };
    }
    return j;
  });

  // Migrate old preference format
  Object.keys(memory.preferences).forEach(key => {
    const pref = memory.preferences[key];
    if (typeof pref === 'string') {
      memory.preferences[key] = {
        value: pref,
        addedOn: new Date().toISOString(),
        lastReferenced: new Date().toISOString()
      };
    }
  });

  // Remove facts older than 30 days that haven't been referenced recently
  const oldFactCount = memory.facts.length;
  memory.facts = memory.facts.filter(fact => {
    const age = now - new Date(fact.addedOn).getTime();
    const timeSinceReference = now - new Date(fact.lastReferenced).getTime();
    // Keep if less than 30 days old OR referenced in last 14 days
    return age < THIRTY_DAYS || timeSinceReference < (14 * 24 * 60 * 60 * 1000);
  });

  // If still too many facts, keep only the most recently referenced
  if (memory.facts.length > MAX_FACTS) {
    memory.facts.sort((a, b) => 
      new Date(b.lastReferenced).getTime() - new Date(a.lastReferenced).getTime()
    );
    memory.facts = memory.facts.slice(0, MAX_FACTS);
  }

  if (oldFactCount !== memory.facts.length) {
    cleaned = true;
    console.log(`🧹 Cleaned ${oldFactCount - memory.facts.length} old facts for ${memory.username}`);
  }

  // Remove old preferences (older than 30 days and not recently referenced)
  const oldPrefCount = Object.keys(memory.preferences).length;
  Object.keys(memory.preferences).forEach(key => {
    const pref = memory.preferences[key];
    const age = now - new Date(pref.addedOn).getTime();
    const timeSinceReference = now - new Date(pref.lastReferenced).getTime();
    
    if (age >= THIRTY_DAYS && timeSinceReference >= (14 * 24 * 60 * 60 * 1000)) {
      delete memory.preferences[key];
    }
  });

  // If still too many preferences, keep most recently referenced
  if (Object.keys(memory.preferences).length > MAX_PREFERENCES) {
    const sortedPrefs = Object.entries(memory.preferences)
      .sort((a, b) => 
        new Date(b[1].lastReferenced).getTime() - new Date(a[1].lastReferenced).getTime()
      )
      .slice(0, MAX_PREFERENCES);
    
    memory.preferences = Object.fromEntries(sortedPrefs);
  }

  if (oldPrefCount !== Object.keys(memory.preferences).length) {
    cleaned = true;
    console.log(`🧹 Cleaned ${oldPrefCount - Object.keys(memory.preferences).length} old preferences for ${memory.username}`);
  }

  // Remove old inside jokes (they get stale faster - 14 days)
  const oldJokeCount = memory.insideJokes.length;
  memory.insideJokes = memory.insideJokes.filter(joke => {
    const age = now - new Date(joke.addedOn).getTime();
    const timeSinceReference = now - new Date(joke.lastReferenced).getTime();
    // Keep if less than 14 days old OR referenced in last 7 days
    return age < (14 * 24 * 60 * 60 * 1000) || timeSinceReference < (7 * 24 * 60 * 60 * 1000);
  });

  // Keep only most recent inside jokes
  if (memory.insideJokes.length > MAX_INSIDE_JOKES) {
    memory.insideJokes.sort((a, b) => 
      new Date(b.lastReferenced).getTime() - new Date(a.lastReferenced).getTime()
    );
    memory.insideJokes = memory.insideJokes.slice(0, MAX_INSIDE_JOKES);
  }

  if (oldJokeCount !== memory.insideJokes.length) {
    cleaned = true;
    console.log(`🧹 Cleaned ${oldJokeCount - memory.insideJokes.length} old inside jokes for ${memory.username}`);
  }

  if (cleaned) {
    saveMemories(memories);
  }

  return cleaned;
}

// Export functions
module.exports = {
  getUserMemory,
  updateLastSeen,
  addFact,
  addPreference,
  addInsideJoke,
  addAchievement,
  updateRoastScore,
  checkAchievements,
  setNickname,
  cleanOldMemories,
  analyzeForMemories,
  formatMemoryForPrompt,
  getMemorySummary
};