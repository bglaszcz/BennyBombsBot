/**
 * Centralized utility for retrieving user nicknames with caching
 *
 * This module provides efficient nickname lookups by caching the userMemories.json
 * file in memory with a TTL (Time To Live) to reduce disk I/O operations.
 *
 * Usage:
 *   const { getNickname, clearCache } = require('./utils/getNickname');
 *   const displayName = getNickname(userId, fallbackUsername);
 */

const fs = require('fs');
const path = require('path');

// Cache configuration
const CACHE_TTL_MS = 5000; // 5 seconds - balance between freshness and performance
let cachedMemories = null;
let cacheTimestamp = 0;

/**
 * Get user's nickname from cached memory data
 * Falls back to provided username if nickname not found
 *
 * @param {string} userId - Discord user ID
 * @param {string} username - Fallback username if nickname not found
 * @returns {string} User's nickname or fallback username
 */
function getNickname(userId, username) {
  const now = Date.now();

  // Reload cache if expired or not yet loaded
  if (!cachedMemories || (now - cacheTimestamp) > CACHE_TTL_MS) {
    loadCache();
  }

  // Return nickname if found, otherwise fallback to username
  return cachedMemories?.[userId]?.nickname || username;
}

/**
 * Load userMemories.json into cache
 * @private
 */
function loadCache() {
  try {
    const memoriesPath = path.join(__dirname, '..', 'userMemories.json');
    if (fs.existsSync(memoriesPath)) {
      const data = fs.readFileSync(memoriesPath, 'utf8');
      cachedMemories = JSON.parse(data);
      cacheTimestamp = Date.now();
    }
  } catch (err) {
    console.error('Error loading userMemories for nickname cache:', err);
    // Keep using stale cache if read fails
  }
}

/**
 * Manually clear the cache (useful for testing or forced refresh)
 */
function clearCache() {
  cachedMemories = null;
  cacheTimestamp = 0;
}

/**
 * Get multiple nicknames at once (more efficient for batch operations)
 *
 * @param {Array<{userId: string, username: string}>} users - Array of user objects
 * @returns {Object} Map of userId to nickname
 */
function getNicknames(users) {
  const now = Date.now();

  // Reload cache if expired
  if (!cachedMemories || (now - cacheTimestamp) > CACHE_TTL_MS) {
    loadCache();
  }

  const result = {};
  for (const user of users) {
    result[user.userId] = cachedMemories?.[user.userId]?.nickname || user.username;
  }

  return result;
}

module.exports = {
  getNickname,
  getNicknames,
  clearCache
};
