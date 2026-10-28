const fs = require('fs');
const path = require('path');
const { generateJson } = require('./gemini');
const { memory: memorySettings } = require('../config/settings');

// Env override lets test scripts point at a copy instead of the live file
const MEMORY_FILE = process.env.USER_MEMORY_FILE || path.join(__dirname, '..', 'userMemories.json');
const TMP_FILE = `${MEMORY_FILE}.tmp`;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_AGE_MS = memorySettings.maxAgeDays * DAY_MS;
const MENTION_COOLDOWN_MS = memorySettings.mentionCooldownDays * DAY_MS;
const NUDGE_COOLDOWN_MS = memorySettings.nudgeCooldownHours * HOUR_MS;

// Debounced save: batch writes within 5 seconds into one
const SAVE_DEBOUNCE_MS = 5000;
let saveTimeout = null;
let pendingSave = false;

// On-disk mtime as of our last successful read/write, so we can tell when
// the file was edited by hand since we last touched it.
let lastKnownMtimeMs = 0;
// Only warn once per bad edit, not on every poll
let invalidFileWarned = false;

function nowIso() {
  return new Date().toISOString();
}

/** ISO string -> epoch ms, with 0 for missing/garbage values */
function ts(iso) {
  return (iso && Date.parse(iso)) || 0;
}

function getFileMtimeMs() {
  try {
    return fs.statSync(MEMORY_FILE).mtimeMs;
  }
  catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Shape / migration
// ---------------------------------------------------------------------------

function normalizeEntry(entry, fallbackDate) {
  if (!entry.addedOn) entry.addedOn = fallbackDate;
  if (!entry.refreshedOn) entry.refreshedOn = entry.addedOn;
  // Old field: was bumped whenever an item was shown to the AI, which made it useless
  delete entry.lastReferenced;
  return entry;
}

/** Bring a user's memory up to the current shape (string items, missing fields, old timestamps) */
function normalizeMemory(memory) {
  const fallback = memory.firstSeen || nowIso();

  // Hand edits can leave odd entries behind; drop anything without text
  const textList = list => (Array.isArray(list) ? list : [])
    .map(item => (typeof item === 'string' ? { text: item } : item))
    .filter(item => item && typeof item.text === 'string')
    .map(item => normalizeEntry(item, fallback));
  memory.facts = textList(memory.facts);
  memory.insideJokes = textList(memory.insideJokes);

  if (!memory.preferences || typeof memory.preferences !== 'object') memory.preferences = {};
  for (const [key, pref] of Object.entries(memory.preferences)) {
    const entry = typeof pref === 'string' ? { value: pref } : pref;
    if (entry && entry.value !== undefined) memory.preferences[key] = normalizeEntry(entry, fallback);
    else delete memory.preferences[key];
  }

  if (!Array.isArray(memory.forgottenFacts)) memory.forgottenFacts = [];
  if (!Array.isArray(memory.forgottenPreferences)) memory.forgottenPreferences = [];
  if (!Array.isArray(memory.achievements)) memory.achievements = [];
  if (typeof memory.messageCount !== 'number') memory.messageCount = 0;
  if (typeof memory.roastScore !== 'number') memory.roastScore = 0;
  if (!memory.firstSeen) memory.firstSeen = fallback;
  return memory;
}

function normalizeAll(all) {
  for (const [userId, memory] of Object.entries(all)) {
    if (!memory || typeof memory !== 'object') {
      delete all[userId];
      continue;
    }
    normalizeMemory(memory);
  }
  return all;
}

// ---------------------------------------------------------------------------
// Disk I/O
// ---------------------------------------------------------------------------

/**
 * Read and parse the memory file.
 * @returns {Object|null} Parsed memories ({} if the file doesn't exist), or null if it isn't valid JSON
 */
function readMemoryFile() {
  if (!fs.existsSync(MEMORY_FILE)) return {};
  const mtime = getFileMtimeMs();
  try {
    const parsed = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    // Only record the mtime once we know the content is good, so a broken
    // file keeps getting retried until it's fixed
    lastKnownMtimeMs = mtime;
    invalidFileWarned = false;
    return normalizeAll(parsed);
  }
  catch {
    return null;
  }
}

function loadAtStartup() {
  const loaded = readMemoryFile();
  if (loaded) return loaded;

  // Invalid file at startup: keep a copy so nothing is lost, then start fresh
  const backup = MEMORY_FILE.replace(/\.json$/, `.corrupt-${Date.now()}.json`);
  try {
    fs.copyFileSync(MEMORY_FILE, backup);
    console.error(`❌ ${path.basename(MEMORY_FILE)} is not valid JSON — backed up to ${path.basename(backup)}, starting with empty memories`);
  }
  catch (error) {
    console.error(`❌ ${path.basename(MEMORY_FILE)} is not valid JSON and could not be backed up:`, error);
  }
  // Allow our next save to replace the broken file
  lastKnownMtimeMs = getFileMtimeMs();
  return {};
}

const memories = loadAtStartup();

function replaceMemories(fresh) {
  Object.keys(memories).forEach(k => delete memories[k]);
  Object.assign(memories, fresh);
}

/**
 * If the file changed on disk since our last read/write (e.g. a hand edit),
 * reload it. Hand-deleted items are simply gone and can be learned again.
 * @returns {boolean} false if the file on disk is currently invalid JSON
 */
function syncFromDiskIfChanged() {
  if (getFileMtimeMs() <= lastKnownMtimeMs) return true;

  const fresh = readMemoryFile();
  if (!fresh) {
    if (!invalidFileWarned) {
      console.warn(`⚠️ ${path.basename(MEMORY_FILE)} has invalid JSON — keeping the in-memory copy and pausing saves until it's fixed`);
      invalidFileWarned = true;
    }
    return false;
  }

  replaceMemories(fresh);
  // Whatever was waiting to be saved belonged to the old copy; the file wins
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = null;
  pendingSave = false;
  console.log(`📥 ${path.basename(MEMORY_FILE)} changed on disk — reloaded`);
  return true;
}

function writeFileAtomic(contents) {
  try {
    // Write to a temp file and swap it in, so a crash mid-write can't leave a half-written file
    fs.writeFileSync(TMP_FILE, contents);
    fs.renameSync(TMP_FILE, MEMORY_FILE);
  }
  catch (error) {
    // Windows can refuse the rename if something briefly holds the file open
    if (error.code !== 'EPERM' && error.code !== 'EBUSY') throw error;
    fs.writeFileSync(MEMORY_FILE, contents);
    fs.rmSync(TMP_FILE, { force: true });
  }
}

function performSave() {
  saveTimeout = null;
  // Never overwrite a hand edit with our stale copy: pick it up instead.
  // If the file is mid-edit and invalid, hold off writing entirely.
  if (getFileMtimeMs() > lastKnownMtimeMs) {
    syncFromDiskIfChanged();
    return;
  }

  try {
    writeFileAtomic(JSON.stringify(memories, null, 2));
    lastKnownMtimeMs = getFileMtimeMs();
    pendingSave = false;
  }
  catch (error) {
    console.error('Error saving memories:', error);
  }
}

/** Schedule a debounced save */
function saveMemories() {
  pendingSave = true;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(performSave, SAVE_DEBOUNCE_MS);
}

/**
 * Write any debounced changes to disk right now. Called from the bot's
 * shutdown handler so nothing is lost on restart.
 */
function flush() {
  if (!pendingSave) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  performSave();
}

// Last-chance flush if the process exits some other way
process.on('exit', flush);

// Poll rather than fs.watch: some editors save via temp-file-then-rename,
// which fs.watch can miss. unref() so one-off scripts can still exit.
fs.watchFile(MEMORY_FILE, { interval: 3000 }, () => syncFromDiskIfChanged()).unref();

/**
 * Force a reload from disk (/memory reload). Edits are normally picked up
 * automatically within a few seconds.
 * @returns {boolean} false if the file is invalid JSON (nothing was reloaded)
 */
function reloadMemories() {
  flush();
  const fresh = readMemoryFile();
  if (!fresh) return false;
  replaceMemories(fresh);
  console.log('🔄 User memories reloaded from disk');
  return true;
}

// ---------------------------------------------------------------------------
// Basic accessors
// ---------------------------------------------------------------------------

/**
 * Get or create a user's memory object
 * @param {string} userId - Discord user ID
 */
function getUserMemory(userId) {
  if (!memories[userId]) {
    memories[userId] = normalizeMemory({
      username: null,
      // Manual override for what to call this person
      nickname: null,
      facts: [],
      preferences: {},
      insideJokes: [],
      forgottenFacts: [],
      forgottenPreferences: [],
      firstSeen: nowIso(),
      lastSeen: nowIso(),
      lastNudgeAt: null,
      messageCount: 0,
      roastScore: 0,
      achievements: [],
    });
    saveMemories();
  }
  return memories[userId];
}

/** Read-only lookup — unlike getUserMemory, never creates an entry */
function peekMemory(userId) {
  return memories[userId] || null;
}

/** Read-only lookup by Discord username, for tables that only stored usernames */
function findMemoryByUsername(username) {
  return Object.values(memories).find(m => m.username === username) || null;
}

function getAllUserIds() {
  return Object.keys(memories);
}

/**
 * Update last seen, message count, and default nickname
 * @param {string} userId - Discord user ID
 * @param {string} username - Current Discord username
 */
function updateLastSeen(userId, username) {
  const memory = getUserMemory(userId);
  memory.username = username;
  if (!memory.nickname) memory.nickname = username;
  memory.lastSeen = nowIso();
  memory.messageCount++;
  saveMemories();
}

function setNickname(userId, nickname) {
  const memory = getUserMemory(userId);
  memory.nickname = nickname;
  saveMemories();
  console.log(`✏️ Set nickname for ${memory.username}: ${nickname}`);
  return memory;
}

// ---------------------------------------------------------------------------
// Learning
// ---------------------------------------------------------------------------

function sameText(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
}

/**
 * Add a text item (fact or inside joke). If it's already known, refresh its
 * expiry timer instead — the user bringing it up again means it's still true.
 */
function addTextItem(list, text) {
  const existing = list.find(item => sameText(item.text, text));
  if (existing) {
    existing.refreshedOn = nowIso();
    return false;
  }
  list.push({ text, addedOn: nowIso(), refreshedOn: nowIso() });
  return true;
}

function addFact(userId, fact) {
  const memory = getUserMemory(userId);
  if (addTextItem(memory.facts, fact)) {
    console.log(`📝 New fact learned about ${memory.username}: ${fact}`);
  }
  saveMemories();
}

function addInsideJoke(userId, joke) {
  const memory = getUserMemory(userId);
  if (addTextItem(memory.insideJokes, joke)) {
    console.log(`😂 New inside joke with ${memory.username}: ${joke}`);
  }
  saveMemories();
}

/**
 * Add or update a preference. Re-learning a category refreshes its expiry
 * timer and keeps its history (addedOn, lastMentioned).
 */
function addPreference(userId, category, value) {
  const memory = getUserMemory(userId);
  const existing = memory.preferences[category];
  if (existing) {
    existing.refreshedOn = nowIso();
    if (existing.value !== value) {
      existing.value = value;
      console.log(`❤️ Updated preference for ${memory.username}: ${category} = ${value}`);
    }
  }
  else {
    memory.preferences[category] = { value, addedOn: nowIso(), refreshedOn: nowIso() };
    console.log(`❤️ New preference for ${memory.username}: ${category} = ${value}`);
  }
  saveMemories();
}

function addAchievement(userId, achievementName) {
  const memory = getUserMemory(userId);
  if (memory.achievements.some(a => a.name === achievementName)) return;
  memory.achievements.push({ name: achievementName, earnedOn: nowIso() });
  saveMemories();
  console.log(`🏆 ${memory.username} earned: ${achievementName}`);
}

function updateRoastScore(userId, change) {
  const memory = getUserMemory(userId);
  memory.roastScore += change;
  saveMemories();

  if (memory.roastScore >= 10) addAchievement(userId, 'Roast Master');
  if (memory.roastScore <= -10) addAchievement(userId, 'Can\'t Take the Heat');
}

function checkAchievements(userId) {
  const memory = getUserMemory(userId);

  const hour = new Date().getHours();
  if (hour >= 2 && hour < 6) addAchievement(userId, 'Night Owl');

  if (memory.messageCount === 50) addAchievement(userId, 'Conversation Master');
  if (memory.messageCount === 100) addAchievement(userId, 'Chatty Cathy');
  if (memory.messageCount === 500) addAchievement(userId, 'Server Regular');
}

/**
 * All remembered items with short IDs (F1, P1, J1...) so the AI can point at them.
 * Each `entry` is the live object in memory, so it can be updated in place.
 */
function listItems(memory) {
  return [
    ...memory.facts.map((f, i) => ({ id: `F${i + 1}`, kind: 'fact', label: f.text, entry: f })),
    ...Object.entries(memory.preferences).map(([key, p], i) => ({ id: `P${i + 1}`, kind: 'preference', label: `${key}: ${p.value}`, entry: p })),
    ...memory.insideJokes.map((j, i) => ({ id: `J${i + 1}`, kind: 'joke', label: j.text, entry: j })),
  ];
}

/**
 * Runs after each bot reply (in the background). Two jobs, one AI call:
 *  1. Work out which remembered items the bot's reply brought up, so they get
 *     marked "already brought up" and aren't repeated.
 *  2. For messages long enough to say something, extract new facts,
 *     preferences, inside jokes and roast context.
 */
async function analyzeForMemories(userId, username, userMessage, botResponse) {
  try {
    const memory = getUserMemory(userId);
    const items = listItems(memory);
    const extract = userMessage.length >= memorySettings.minAnalysisLength;
    if (!extract && items.length === 0) return;

    const forgottenFacts = memory.forgottenFacts;
    const forgottenPrefCategories = memory.forgottenPreferences;
    const itemList = items.length > 0
      ? items.map(i => `${i.id} (${i.kind}): ${i.label}`).join('\n')
      : '(none)';

    const referencedTask = `**referenced**: Which of the known items above did the BOT'S RESPONSE bring up, mention, or allude to?
   - Only count an item if the bot's response clearly references that specific thing
   - Return their IDs, e.g. ["F1", "P2"], or [] if none`;

    const extractTasks = `
Also extract ONLY NEW information about the user that isn't already captured above:

**facts**: Personal information the USER explicitly stated (job, location, hobbies, life events, etc.)
   - ONLY from the user's message — NEVER from anything the bot said
   - SKIP if the same or essentially the same fact is already known
   - Example: "I'm a software engineer" → "is a software engineer"
   - Example: "I just got a dog" → "recently got a dog"

**preferences**: Things the USER likes/dislikes, their opinions, or preferences
   - ONLY from the user's message — NEVER from anything the bot said
   - If it matches a known preference category, reuse that exact category name
   - Example: "I love Python" → {"category": "programming language", "value": "loves Python"}

**insideJokes**: A joke or funny reference the USER made that could be brought up again
   - Only if the user themselves made the joke — not something the bot invented
   - SKIP if it's already a known inside joke

**roastContext**: "roast_requested" if the user explicitly asked to be roasted, "trash_talk" if they engaged in playful banter, otherwise null

The user (or an admin) explicitly asked to forget these — DO NOT re-add them or anything near-equivalent:
Forgotten facts: ${forgottenFacts.length > 0 ? forgottenFacts.map(f => `- ${f}`).join('\n') : '(none)'}
Forgotten preference categories: ${forgottenPrefCategories.length > 0 ? forgottenPrefCategories.join(', ') : '(none)'}`;

    const analysisPrompt = `Analyze this Discord exchange between a user and a chat bot.

User: ${username}
User's message: "${userMessage}"
Bot's response: "${botResponse}"

Already known about this user:
${itemList}

${referencedTask}
${extract ? extractTasks : ''}

Return ONLY valid JSON in this exact format:
${extract
    ? '{"referenced": [], "facts": [], "preferences": [{"category": "...", "value": "..."}], "insideJokes": [], "roastContext": null}'
    : '{"referenced": []}'}

CRITICAL RULES:
- Facts and preferences must come ONLY from what the user explicitly said — the bot's response may contain jokes or fabrications
- Don't infer beyond what the user literally said
- Keep facts concise and specific
- Use empty arrays when nothing applies`;

    const analysis = await generateJson(analysisPrompt);
    if (!analysis) {
      console.log('No valid JSON found in memory analysis response');
      return;
    }

    // 1. Mark what the bot just brought up
    if (Array.isArray(analysis.referenced) && analysis.referenced.length > 0) {
      const byId = new Map(items.map(i => [i.id, i.entry]));
      const mentionedAt = nowIso();
      analysis.referenced.forEach(id => {
        const entry = byId.get(String(id).trim().toUpperCase());
        if (entry) entry.lastMentioned = mentionedAt;
      });
      saveMemories();
    }

    if (!extract) return;

    // 2. Learn new things, excluding anything explicitly forgotten
    if (Array.isArray(analysis.facts)) {
      analysis.facts
        .filter(fact => typeof fact === 'string' && fact.trim() && !forgottenFacts.includes(fact))
        .forEach(fact => addFact(userId, fact.trim()));
    }

    if (Array.isArray(analysis.preferences)) {
      analysis.preferences
        .filter(pref => pref && pref.category && pref.value && !forgottenPrefCategories.includes(pref.category))
        .forEach(pref => addPreference(userId, pref.category, pref.value));
    }

    if (Array.isArray(analysis.insideJokes)) {
      analysis.insideJokes
        .filter(joke => typeof joke === 'string' && joke.trim())
        .forEach(joke => addInsideJoke(userId, joke.trim()));
    }

    if (analysis.roastContext === 'roast_requested') {
      updateRoastScore(userId, 1);
    }
    else if (analysis.roastContext === 'trash_talk') {
      updateRoastScore(userId, 0.5);
    }
  }
  catch (error) {
    // Memory analysis failing shouldn't break the bot
    console.error('Error analyzing conversation for memories:', error);
  }
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

function formatAgo(ms) {
  const days = Math.floor(ms / DAY_MS);
  if (days === 0) return 'less than a day ago';
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/**
 * Pick at most one item the bot may bring up on its own. Limited to one per
 * user per nudge cooldown, and never something mentioned or offered recently.
 * Side effect: records the nudge so it isn't offered again right away.
 */
function pickNudge(memory, items, now) {
  if (now - ts(memory.lastNudgeAt) < NUDGE_COOLDOWN_MS) return null;

  const lastUsed = item => Math.max(ts(item.entry.lastMentioned), ts(item.entry.lastNudged));
  const eligible = items
    .filter(item => now - lastUsed(item) >= MENTION_COOLDOWN_MS)
    .sort((a, b) => lastUsed(a) - lastUsed(b));
  if (eligible.length === 0) return null;

  const pick = eligible[0];
  pick.entry.lastNudged = new Date(now).toISOString();
  memory.lastNudgeAt = pick.entry.lastNudged;
  saveMemories();
  return pick;
}

/**
 * Format a user's memory for the chat prompt. Everything is listed as
 * background (only to be used if the user brings it up). Items the bot
 * mentioned recently are labeled so it doesn't repeat them, and occasionally
 * one item is offered as OK to bring up unprompted.
 * @param {string} userId - Discord user ID
 * @returns {string}
 */
function formatMemoryForPrompt(userId) {
  const memory = getUserMemory(userId);
  const now = Date.now();
  const items = listItems(memory);

  let context = `User: ${memory.nickname || memory.username}\n`;

  if (items.length === 0) {
    context += '(Nothing remembered about them yet.)\n';
  }
  else {
    const nudge = pickNudge(memory, items, now);
    const describe = item => {
      const ago = now - ts(item.entry.lastMentioned);
      const note = ago < MENTION_COOLDOWN_MS
        ? ` (already brought up ${formatAgo(ago)} — don't mention it again unless they do)`
        : '';
      return `- ${item.label}${note}\n`;
    };

    const background = items.filter(item => item !== nudge);
    const section = (title, kind) => {
      const lines = background.filter(item => item.kind === kind);
      return lines.length > 0 ? `${title}:\n${lines.map(describe).join('')}` : '';
    };

    if (background.length > 0) {
      context += '\nBackground — use only if they bring the topic up or ask. Do NOT bring these up yourself:\n';
      context += section('Facts', 'fact');
      context += section('Preferences', 'preference');
      context += section('Inside jokes you share', 'joke');
    }

    if (nudge) {
      context += `\nIf there's a natural opening, you MAY casually bring up this one thing (skip it if it doesn't fit):\n- ${nudge.label}\n`;
    }
  }

  if (memory.roastScore !== 0) {
    context += `\nRoast engagement: ${memory.roastScore > 0 ? 'Loves the banter' : 'Sensitive to roasts'}\n`;
  }

  return context;
}

// ---------------------------------------------------------------------------
// /memory command helpers
// ---------------------------------------------------------------------------

function getMemorySummary(userId) {
  const memory = peekMemory(userId) || normalizeMemory({});
  const daysSinceFirstSeen = Math.floor((Date.now() - ts(memory.firstSeen)) / DAY_MS);

  const displayPreferences = {};
  Object.entries(memory.preferences).forEach(([key, pref]) => {
    displayPreferences[key] = pref.value;
  });

  return {
    username: memory.username,
    facts: memory.facts.map(f => f.text),
    preferences: displayPreferences,
    insideJokes: memory.insideJokes.map(j => j.text),
    messageCount: memory.messageCount,
    roastScore: memory.roastScore,
    achievements: memory.achievements,
    daysSinceFirstSeen,
  };
}

/** /memory forget: removes the fact and blocks it from being learned again */
function removeFact(userId, factText) {
  const memory = getUserMemory(userId);
  const before = memory.facts.length;
  memory.facts = memory.facts.filter(f => f.text !== factText);
  if (memory.facts.length === before) return false;
  if (!memory.forgottenFacts.includes(factText)) memory.forgottenFacts.push(factText);
  saveMemories();
  return true;
}

/** /memory forget: removes the preference and blocks the category from being learned again */
function removePreference(userId, category) {
  const memory = getUserMemory(userId);
  if (memory.preferences[category] === undefined) return false;
  delete memory.preferences[category];
  if (!memory.forgottenPreferences.includes(category)) memory.forgottenPreferences.push(category);
  saveMemories();
  return true;
}

// ---------------------------------------------------------------------------
// Expiry
// ---------------------------------------------------------------------------

/**
 * Drop entries the user hasn't brought up within maxAgeDays, then trim to the
 * cap, keeping the most recently refreshed.
 * @returns {Array} The pruned list (original order preserved when not over cap)
 */
function pruneEntries(entries, max, now) {
  const kept = entries.filter(([, entry]) => now - ts(entry.refreshedOn) < MAX_AGE_MS);
  if (kept.length <= max) return kept;
  return [...kept].sort((a, b) => ts(b[1].refreshedOn) - ts(a[1].refreshedOn)).slice(0, max);
}

/**
 * Remove stale memories for a user
 * @param {string} userId - Discord user ID
 * @returns {boolean} True if anything was removed
 */
function cleanOldMemories(userId) {
  const memory = getUserMemory(userId);
  const now = Date.now();
  let cleaned = false;

  const report = (label, before, after) => {
    if (before === after) return;
    cleaned = true;
    console.log(`🧹 Cleaned ${before - after} stale ${label} for ${memory.username}`);
  };

  const facts = pruneEntries(memory.facts.map(f => [null, f]), memorySettings.maxFacts, now);
  report('facts', memory.facts.length, facts.length);
  memory.facts = facts.map(([, f]) => f);

  const prefs = pruneEntries(Object.entries(memory.preferences), memorySettings.maxPreferences, now);
  report('preferences', Object.keys(memory.preferences).length, prefs.length);
  memory.preferences = Object.fromEntries(prefs);

  const jokes = pruneEntries(memory.insideJokes.map(j => [null, j]), memorySettings.maxInsideJokes, now);
  report('inside jokes', memory.insideJokes.length, jokes.length);
  memory.insideJokes = jokes.map(([, j]) => j);

  if (cleaned) saveMemories();
  return cleaned;
}

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
  getMemorySummary,
};
