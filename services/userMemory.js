const fs = require('fs');
const path = require('path');
const { generateJson } = require('./gemini');

const MEMORY_FILE = path.join(__dirname, '..', 'userMemories.json');

// Debounced save configuration
const SAVE_DEBOUNCE_MS = 5000; // 5 seconds - batch writes for efficiency
let saveTimeout = null;
let pendingSave = false;

// Tracks the on-disk mtime as of our last read/write, so we can tell when
// the file was edited externally (e.g. by hand) since we last touched it.
let lastKnownMtimeMs = 0;

function getFileMtimeMs() {
  try {
    return fs.statSync(MEMORY_FILE).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * Load memories from file system
 * @returns {Object} User memories object indexed by userId
 */
function loadMemories() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      const data = fs.readFileSync(MEMORY_FILE, 'utf8');
      lastKnownMtimeMs = getFileMtimeMs();
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading memories:', error);
  }
  return {};
}

/**
 * Save memories to file with debouncing to reduce I/O operations
 * Batches multiple save requests within 5 seconds into a single write
 * @param {Object} memories - Memories object to save
 * @param {boolean} immediate - Force immediate save (bypass debouncing)
 */
function saveMemories(memories, immediate = false) {
  pendingSave = true;

  // Clear existing timeout
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  // Force immediate save if requested (e.g., on shutdown)
  if (immediate) {
    performSave(memories);
    return;
  }

  // Debounce: delay save to batch multiple operations
  saveTimeout = setTimeout(() => {
    performSave(memories);
  }, SAVE_DEBOUNCE_MS);
}

/**
 * Diff a user's old facts/preferences against a freshly-loaded copy and
 * record anything that disappeared as "forgotten" so analyzeForMemories()
 * won't silently re-learn it later.
 * @param {Object} previous - In-memory memories object before the reload
 * @param {Object} fresh - Memories object just loaded from disk
 * @returns {boolean} Whether anything was actually merged in (i.e. a write-back is needed)
 */
function mergeForgottenFromExternalEdit(previous, fresh) {
  let changed = false;

  Object.keys(previous).forEach(userId => {
    const oldMem = previous[userId];
    const newMem = fresh[userId];
    if (!oldMem || !newMem) return;

    const oldFactTexts = (oldMem.facts || []).map(f => typeof f === 'string' ? f : f.text);
    const newFactTexts = new Set((newMem.facts || []).map(f => typeof f === 'string' ? f : f.text));
    newMem.forgottenFacts = newMem.forgottenFacts || [];
    oldFactTexts
      .filter(t => !newFactTexts.has(t))
      .forEach(t => {
        if (!newMem.forgottenFacts.includes(t)) {
          newMem.forgottenFacts.push(t);
          changed = true;
        }
      });

    const oldPrefKeys = Object.keys(oldMem.preferences || {});
    const newPrefKeys = new Set(Object.keys(newMem.preferences || {}));
    newMem.forgottenPreferences = newMem.forgottenPreferences || [];
    oldPrefKeys
      .filter(k => !newPrefKeys.has(k))
      .forEach(k => {
        if (!newMem.forgottenPreferences.includes(k)) {
          newMem.forgottenPreferences.push(k);
          changed = true;
        }
      });
  });

  return changed;
}

/**
 * Actually perform the file write operation
 * If the file was modified externally (e.g. hand-edited) since our last
 * read/write, reload it instead of blindly overwriting those changes with
 * our stale in-memory copy.
 * @param {Object} memories - Memories object to write
 */
function performSave(memories) {
  try {
    if (getFileMtimeMs() > lastKnownMtimeMs) {
      console.log('⚠️ userMemories.json was edited externally — reloading and preserving your edits');
      const fresh = loadMemories();
      const changed = mergeForgottenFromExternalEdit(memories, fresh);
      Object.keys(memories).forEach(k => delete memories[k]);
      Object.assign(memories, fresh);
      lastKnownMtimeMs = getFileMtimeMs();
      pendingSave = false;
      saveTimeout = null;
      // Only write back if we actually recorded new forgotten items; otherwise
      // the reloaded content already matches disk and a no-op write would just
      // bump the mtime and cause this branch to re-trigger on the next poll.
      if (changed) performSave(memories);
      return;
    }

    fs.writeFileSync(MEMORY_FILE, JSON.stringify(memories, null, 2));
    lastKnownMtimeMs = getFileMtimeMs();
    pendingSave = false;
    saveTimeout = null;
  } catch (error) {
    console.error('Error saving memories:', error);
  }
}

/**
 * Write any debounced changes to disk right now. Called from the bot's
 * shutdown handler so nothing is lost on restart.
 */
function flush() {
  if (!pendingSave) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  performSave(memories);
}

// Last-chance flush if the process exits some other way
process.on('exit', flush);

const memories = loadMemories();

/**
 * If the on-disk file has changed since our last read/write, reload it,
 * remembering anything that was hand-deleted so it doesn't get re-learned.
 * Called on a poll interval so manual edits to userMemories.json while the
 * bot is running take effect on their own, without a restart or command.
 */
function syncFromDiskIfChanged() {
  const diskMtime = getFileMtimeMs();
  if (diskMtime <= lastKnownMtimeMs) return;

  const fresh = loadMemories();
  const changed = mergeForgottenFromExternalEdit(memories, fresh);
  Object.keys(memories).forEach(k => delete memories[k]);
  Object.assign(memories, fresh);
  lastKnownMtimeMs = getFileMtimeMs();

  // If nothing was actually merged in, the reload was a no-op (e.g. we're
  // seeing our own prior write, or another process's save) — skip the write-back.
  // Writing back here when nothing changed would bump the mtime and cause this
  // handler to re-fire on the next poll, looping forever.
  if (!changed) return;

  console.log('📥 Detected manual edit to userMemories.json — syncing and remembering removed items');

  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
    pendingSave = false;
  }

  saveMemories(memories, true);
}

// Poll rather than fs.watch: some editors save via a temp-file-then-rename,
// which fs.watch can miss or lose the handle for. Polling the mtime is slower
// (a few seconds) but reliable across editors/platforms.
// unref() so one-off scripts that import this module can still exit
fs.watchFile(MEMORY_FILE, { interval: 3000 }, syncFromDiskIfChanged).unref();

/**
 * Get or create user memory object
 * Creates a new memory structure if user doesn't exist
 *
 * @param {string} userId - Discord user ID
 * @returns {Object} User memory object with all tracked data
 */
function getUserMemory(userId) {
  if (!memories[userId]) {
    memories[userId] = {
      username: null,
      nickname: null, // Manual override for what to call this person
      facts: [],
      preferences: {},
      insideJokes: [],
      forgottenFacts: [],
      forgottenPreferences: [],
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      messageCount: 0,
      roastScore: 0,
      achievements: []
    };
    saveMemories(memories);
  }
  const memory = memories[userId];
  // Migrate memory objects created before forgotten-lists existed
  if (!memory.forgottenFacts) memory.forgottenFacts = [];
  if (!memory.forgottenPreferences) memory.forgottenPreferences = [];
  return memory;
}

/**
 * Update user's last seen timestamp and message count
 * Also sets nickname to username if not already set
 *
 * @param {string} userId - Discord user ID
 * @param {string} username - Current Discord username
 */
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

/**
 * Add a fact to user's memory (with deduplication)
 * Updates lastReferenced timestamp if fact already exists
 *
 * @param {string} userId - Discord user ID
 * @param {string} fact - Fact text to add
 */
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

/**
 * Add or update a user preference
 * Overwrites existing preference in the same category
 *
 * @param {string} userId - Discord user ID
 * @param {string} category - Preference category (e.g., "music", "food")
 * @param {string} value - Preference value
 */
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

/**
 * Add an inside joke to user's memory (with deduplication)
 * Updates lastReferenced timestamp if joke already exists
 *
 * @param {string} userId - Discord user ID
 * @param {string} joke - Inside joke text to add
 */
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

/**
 * AI-powered memory analysis of conversation
 * Analyzes user messages and bot responses to extract memorable information
 * Runs asynchronously in background to avoid blocking responses
 *
 * @param {string} userId - Discord user ID
 * @param {string} username - User's display name
 * @param {string} userMessage - The user's message
 * @param {string} botResponse - The bot's response
 * @returns {Promise<void>}
 */
async function analyzeForMemories(userId, username, userMessage, botResponse) {
  try {
    const memory = getUserMemory(userId);
    const existingFacts = memory.facts.map(f => f.text);
    const existingPrefs = Object.entries(memory.preferences).map(([k, v]) => `${k}: ${v.value}`);
    const forgottenFacts = memory.forgottenFacts || [];
    const forgottenPrefCategories = memory.forgottenPreferences || [];

    const analysisPrompt = `Analyze this Discord conversation and extract any memorable information about the user.

User: ${username}
User's message: "${userMessage}"
Bot's response (for roast/joke context only): "${botResponse}"

Already known about this user (DO NOT re-add these or near-duplicates):
Facts: ${existingFacts.length > 0 ? existingFacts.map(f => `- ${f}`).join('\n') : '(none)'}
Preferences: ${existingPrefs.length > 0 ? existingPrefs.map(p => `- ${p}`).join('\n') : '(none)'}

The user (or an admin) has explicitly asked to forget these — DO NOT re-add them or anything near-equivalent, even if the topic comes up again:
Forgotten facts: ${forgottenFacts.length > 0 ? forgottenFacts.map(f => `- ${f}`).join('\n') : '(none)'}
Forgotten preference categories: ${forgottenPrefCategories.length > 0 ? forgottenPrefCategories.join(', ') : '(none)'}

Extract ONLY NEW information not already captured above:

1. **Facts**: Personal information the USER explicitly stated (job, location, hobbies, life events, etc.)
   - ONLY from the user's message — NEVER from anything the bot said
   - SKIP if the same or essentially the same fact is already known
   - Example: "I'm a software engineer" → fact: "is a software engineer"
   - Example: "I live in Seattle" → fact: "lives in Seattle"
   - Example: "I just got a dog" → fact: "recently got a dog"

2. **Preferences**: Things the USER likes/dislikes, their opinions, or preferences
   - ONLY from the user's message — NEVER from anything the bot said
   - SKIP if the same or essentially the same preference is already known
   - Example: "I love Python" → preference: {"topic": "programming language", "value": "loves Python"}
   - Example: "I hate mornings" → preference: {"topic": "morning person", "value": "hates mornings"}

3. **Inside Jokes**: A joke or funny reference the USER made that could be brought up again
   - Only include if the user themselves made the joke — not something the bot invented
   - Example: If the user made a funny typo or a running gag they started

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

CRITICAL RULES:
- Facts and preferences must come ONLY from what the user explicitly said in their message
- The bot's response may contain jokes, assumptions, or fabrications — do NOT treat anything in the bot's response as a fact about the user
- Don't make assumptions or inferences beyond what the user literally said
- Keep facts concise and specific
- Return empty arrays if nothing found
- MUST return valid JSON only, no other text`;

    const analysis = await generateJson(analysisPrompt);
    if (!analysis) {
      console.log('No valid JSON found in AI response');
      return;
    }
    
    // Process extracted information, excluding anything explicitly forgotten
    if (analysis.facts && analysis.facts.length > 0) {
      analysis.facts
        .filter(fact => !forgottenFacts.includes(fact))
        .forEach(fact => addFact(userId, fact));
    }

    if (analysis.preferences && analysis.preferences.length > 0) {
      analysis.preferences
        .filter(pref => !forgottenPrefCategories.includes(pref.category))
        .forEach(pref => {
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

/**
 * Format user memory for inclusion in AI prompt
 * WARNING: Side effect - updates lastReferenced timestamps for included items
 *
 * @param {string} userId - Discord user ID
 * @returns {string} Formatted memory context for prompt
 */
function formatMemoryForPrompt(userId) {
  const memory = getUserMemory(userId);
  const displayName = memory.nickname || memory.username;
  
  let context = `User: ${displayName}\n`;
  context += `Messages sent: ${memory.messageCount}\n`;
  context += `Known since: ${new Date(memory.firstSeen).toLocaleDateString()}\n`;
  
  // Rotate facts: show the least-recently-surfaced ones, then bump their timestamp
  const FACTS_PER_PROMPT = 4;
  const PREFS_PER_PROMPT = 3;

  if (memory.facts.length > 0) {
    const sorted = [...memory.facts].sort((a, b) =>
      new Date(a.lastReferenced).getTime() - new Date(b.lastReferenced).getTime()
    );
    const selected = sorted.slice(0, FACTS_PER_PROMPT);
    context += `\nThings I know about them:\n`;
    selected.forEach(fact => {
      context += `- ${fact.text}\n`;
      fact.lastReferenced = new Date().toISOString();
    });
  }

  if (Object.keys(memory.preferences).length > 0) {
    const sorted = Object.entries(memory.preferences).sort((a, b) =>
      new Date(a[1].lastReferenced).getTime() - new Date(b[1].lastReferenced).getTime()
    );
    const selected = sorted.slice(0, PREFS_PER_PROMPT);
    context += `\nTheir preferences:\n`;
    selected.forEach(([key, pref]) => {
      context += `- ${key}: ${pref.value}\n`;
      pref.lastReferenced = new Date().toISOString();
    });
  }
  
  if (memory.insideJokes.length > 0) {
    context += `\nInside jokes we share (reference ONE of these naturally if it fits, do not force it):\n`;
    memory.insideJokes.forEach(joke => {
      const jokeText = typeof joke === 'string' ? joke : joke.text;
      context += `- ${jokeText}\n`;
    });
    // Delete all inside jokes after including them once - they're single-use
    memory.insideJokes = [];
    saveMemories(memories);
  }

  if (memory.roastScore !== 0) {
    context += `\nRoast engagement: ${memory.roastScore > 0 ? 'Loves the banter' : 'Sensitive to roasts'}\n`;
  }

  saveMemories(memories);
  return context;
}

// Get memory summary for /memory command
function getMemorySummary(userId) {
  const memory = peekMemory(userId) || {
    username: null, facts: [], preferences: {}, insideJokes: [],
    messageCount: 0, roastScore: 0, achievements: [], firstSeen: new Date().toISOString(),
  };
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

function getAllUserIds() {
  return Object.keys(memories);
}

/** Read-only lookup — unlike getUserMemory, never creates an entry */
function peekMemory(userId) {
  return memories[userId] || null;
}

/** Read-only lookup by Discord username, for tables that only stored usernames */
function findMemoryByUsername(username) {
  return Object.values(memories).find(m => m.username === username) || null;
}

function reloadMemories() {
  // Flush any pending debounced save first so we don't lose recent writes
  if (pendingSave && saveTimeout) {
    clearTimeout(saveTimeout);
    performSave(memories);
  }
  const fresh = loadMemories();
  mergeForgottenFromExternalEdit(memories, fresh);
  Object.keys(memories).forEach(k => delete memories[k]);
  Object.assign(memories, fresh);
  lastKnownMtimeMs = getFileMtimeMs();
  console.log('🔄 User memories reloaded from disk');
}

function removeFact(userId, factText) {
  const memory = getUserMemory(userId);
  const before = memory.facts.length;
  memory.facts = memory.facts.filter(f => (typeof f === 'string' ? f : f.text) !== factText);
  if (memory.facts.length !== before) {
    if (!memory.forgottenFacts.includes(factText)) memory.forgottenFacts.push(factText);
    saveMemories(memories);
    return true;
  }
  return false;
}

function removePreference(userId, category) {
  const memory = getUserMemory(userId);
  if (memory.preferences[category] !== undefined) {
    delete memory.preferences[category];
    if (!memory.forgottenPreferences.includes(category)) memory.forgottenPreferences.push(category);
    saveMemories(memories);
    return true;
  }
  return false;
}

/**
 * Manually set a nickname for a user
 *
 * @param {string} userId - Discord user ID
 * @param {string} nickname - Desired nickname
 * @returns {Object} Updated memory object
 */
function setNickname(userId, nickname) {
  const memory = getUserMemory(userId);
  memory.nickname = nickname;
  saveMemories(memories);
  console.log(`✏️ Set nickname for ${memory.username}: ${nickname}`);
  return memory;
}

/**
 * Clean old memories based on lastReferenced date
 * Removes facts not referenced in 30 days, preferences not referenced in 30 days,
 * and inside jokes not referenced in 14 days. Also enforces maximum limits.
 *
 * @param {string} userId - Discord user ID
 * @returns {boolean} True if any cleanup was performed
 */
function cleanOldMemories(userId) {
  const memory = getUserMemory(userId);
  const now = Date.now();

  // Age thresholds based on addedOn — facts expire by age, not by last use.
  // formatMemoryForPrompt updates lastReferenced for rotation, so using it for
  // expiry would prevent cleanup from ever running.
  const FACT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const JOKE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

  // Maximum item limits
  const MAX_FACTS = 10;
  const MAX_PREFERENCES = 8;
  const MAX_INSIDE_JOKES = 5;

  let cleaned = false;

  // Migrate old string-based facts to new format (preserve old date as fallback)
  memory.facts = memory.facts.map(f => {
    if (typeof f === 'string') {
      // Use memory.firstSeen as fallback for legacy items
      const fallbackDate = memory.firstSeen || new Date().toISOString();
      return {
        text: f,
        addedOn: fallbackDate,
        lastReferenced: fallbackDate
      };
    }
    return f;
  });

  // Migrate old string-based inside jokes
  memory.insideJokes = memory.insideJokes.map(j => {
    if (typeof j === 'string') {
      const fallbackDate = memory.firstSeen || new Date().toISOString();
      return {
        text: j,
        addedOn: fallbackDate,
        lastReferenced: fallbackDate
      };
    }
    return j;
  });

  // Migrate old preference format
  Object.keys(memory.preferences).forEach(key => {
    const pref = memory.preferences[key];
    if (typeof pref === 'string') {
      const fallbackDate = memory.firstSeen || new Date().toISOString();
      memory.preferences[key] = {
        value: pref,
        addedOn: fallbackDate,
        lastReferenced: fallbackDate
      };
    }
  });

  // Remove facts older than FACT_MAX_AGE_MS (based on when they were first learned)
  const oldFactCount = memory.facts.length;
  memory.facts = memory.facts.filter(fact => {
    const age = now - new Date(fact.addedOn).getTime();
    return age < FACT_MAX_AGE_MS;
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
    console.log(`🧹 Cleaned ${oldFactCount - memory.facts.length} stale facts for ${memory.username}`);
  }

  // Remove preferences older than FACT_MAX_AGE_MS (based on when they were first added)
  const oldPrefCount = Object.keys(memory.preferences).length;
  Object.keys(memory.preferences).forEach(key => {
    const pref = memory.preferences[key];
    const age = now - new Date(pref.addedOn).getTime();
    if (age >= FACT_MAX_AGE_MS) {
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
    console.log(`🧹 Cleaned ${oldPrefCount - Object.keys(memory.preferences).length} stale preferences for ${memory.username}`);
  }

  // Remove inside jokes older than JOKE_MAX_AGE_MS
  const oldJokeCount = memory.insideJokes.length;
  memory.insideJokes = memory.insideJokes.filter(joke => {
    const age = now - new Date(joke.addedOn).getTime();
    return age < JOKE_MAX_AGE_MS;
  });

  // Keep only most recently referenced inside jokes
  if (memory.insideJokes.length > MAX_INSIDE_JOKES) {
    memory.insideJokes.sort((a, b) =>
      new Date(b.lastReferenced).getTime() - new Date(a.lastReferenced).getTime()
    );
    memory.insideJokes = memory.insideJokes.slice(0, MAX_INSIDE_JOKES);
  }

  if (oldJokeCount !== memory.insideJokes.length) {
    cleaned = true;
    console.log(`🧹 Cleaned ${oldJokeCount - memory.insideJokes.length} stale inside jokes for ${memory.username}`);
  }

  if (cleaned) {
    saveMemories(memories);
  }

  return cleaned;
}

// Export functions
module.exports = {
  flush,
  getUserMemory,
  peekMemory,
  findMemoryByUsername,
  getAllUserIds,
  reloadMemories,
  updateLastSeen,
  addFact,
  addPreference,
  addInsideJoke,
  addAchievement,
  updateRoastScore,
  checkAchievements,
  setNickname,
  cleanOldMemories,
  removeFact,
  removePreference,
  analyzeForMemories,
  formatMemoryForPrompt,
  getMemorySummary
};