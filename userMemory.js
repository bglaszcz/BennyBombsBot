const fs = require('fs');
const path = require('path');

class UserMemorySystem {
  constructor() {
    this.memoryFile = path.join(__dirname, 'userMemories.json');
    this.memories = this.loadMemories();
  }

  loadMemories() {
    try {
      if (fs.existsSync(this.memoryFile)) {
        const data = fs.readFileSync(this.memoryFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading memories:', error);
    }
    return {};
  }

  saveMemories() {
    try {
      fs.writeFileSync(this.memoryFile, JSON.stringify(this.memories, null, 2));
    } catch (error) {
      console.error('Error saving memories:', error);
    }
  }

  getUserMemory(userId) {
    if (!this.memories[userId]) {
      this.memories[userId] = {
        username: '',
        facts: [],
        preferences: {},
        insideJokes: [],
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        messageCount: 0,
        roastScore: 0,
        achievements: []
      };
    }
    return this.memories[userId];
  }

  updateLastSeen(userId, username) {
    const memory = this.getUserMemory(userId);
    memory.username = username;
    memory.lastSeen = new Date().toISOString();
    memory.messageCount++;
    this.saveMemories();
  }

  addFact(userId, fact) {
    const memory = this.getUserMemory(userId);
    // Avoid duplicates
    if (!memory.facts.includes(fact)) {
      memory.facts.push({
        text: fact,
        addedOn: new Date().toISOString()
      });
      // Keep only last 20 facts
      if (memory.facts.length > 20) {
        memory.facts.shift();
      }
      this.saveMemories();
    }
  }

  addPreference(userId, category, value) {
    const memory = this.getUserMemory(userId);
    memory.preferences[category] = value;
    this.saveMemories();
  }

  addInsideJoke(userId, joke) {
    const memory = this.getUserMemory(userId);
    if (!memory.insideJokes.includes(joke)) {
      memory.insideJokes.push(joke);
      if (memory.insideJokes.length > 10) {
        memory.insideJokes.shift();
      }
      this.saveMemories();
    }
  }

  adjustRoastScore(userId, points) {
    const memory = this.getUserMemory(userId);
    memory.roastScore += points;
    this.saveMemories();
  }

  addAchievement(userId, achievement) {
    const memory = this.getUserMemory(userId);
    if (!memory.achievements.includes(achievement)) {
      memory.achievements.push({
        name: achievement,
        earnedOn: new Date().toISOString()
      });
      this.saveMemories();
    }
  }

  getMemorySummary(userId) {
    const memory = this.getUserMemory(userId);
    const daysSinceFirstSeen = Math.floor(
      (new Date() - new Date(memory.firstSeen)) / (1000 * 60 * 60 * 24)
    );

    return {
      username: memory.username,
      daysSinceFirstSeen,
      messageCount: memory.messageCount,
      factCount: memory.facts.length,
      facts: memory.facts.slice(-5).map(f => f.text), // Last 5 facts
      preferences: memory.preferences,
      insideJokes: memory.insideJokes,
      roastScore: memory.roastScore,
      achievements: memory.achievements
    };
  }

  formatMemoryForPrompt(userId) {
    const summary = this.getMemorySummary(userId);
    
    if (summary.messageCount === 0) {
      return "This is a new user you haven't talked to before.";
    }

    let memoryText = `You've chatted with ${summary.username} ${summary.messageCount} times over ${summary.daysSinceFirstSeen} days.`;
    
    if (summary.facts.length > 0) {
      memoryText += `\n\nThings you know about them:`;
      summary.facts.forEach(fact => {
        memoryText += `\n- ${fact}`;
      });
    }

    if (Object.keys(summary.preferences).length > 0) {
      memoryText += `\n\nTheir preferences:`;
      Object.entries(summary.preferences).forEach(([key, value]) => {
        memoryText += `\n- ${key}: ${value}`;
      });
    }

    if (summary.insideJokes.length > 0) {
      memoryText += `\n\nInside jokes: ${summary.insideJokes.join(', ')}`;
    }

    if (summary.roastScore !== 0) {
      memoryText += `\n\nRoast battle score: ${summary.roastScore > 0 ? '+' : ''}${summary.roastScore}`;
    }

    return memoryText;
  }

  // Extract potential facts from conversation
  analyzeForMemories(message, response) {
    const memories = [];
    const content = message.toLowerCase();

    // Detect preferences
    if (content.includes('i love') || content.includes('i like')) {
      const match = content.match(/i (?:love|like) ([^.,!?]+)/i);
      if (match) memories.push({ type: 'fact', value: `likes ${match[1]}` });
    }

    if (content.includes('i hate') || content.includes("i don't like")) {
      const match = content.match(/i (?:hate|don't like) ([^.,!?]+)/i);
      if (match) memories.push({ type: 'fact', value: `hates ${match[1]}` });
    }

    // Detect personal info
    if (content.includes('my name is') || content.includes("i'm ")) {
      const match = content.match(/(?:my name is|i'm) ([a-zA-Z]+)/i);
      if (match) memories.push({ type: 'preference', category: 'name', value: match[1] });
    }

    // Detect hobbies/activities
    if (content.includes('i play') || content.includes('i do')) {
      const match = content.match(/i (?:play|do) ([^.,!?]+)/i);
      if (match) memories.push({ type: 'fact', value: `does ${match[1]}` });
    }

    return memories;
  }
}

module.exports = new UserMemorySystem();