/**
 * Nickname lookups backed by the in-memory userMemory store (no disk reads).
 *
 * Usage:
 *   const { getNickname } = require('./utils/getNickname');
 *   const displayName = getNickname(userId, fallbackUsername);
 */

const userMemory = require('../services/userMemory');

/**
 * @param {string} userId - Discord user ID
 * @param {string} username - Fallback if no nickname is stored
 * @returns {string}
 */
function getNickname(userId, username) {
  return userMemory.peekMemory(userId)?.nickname || username;
}

/**
 * For older tables that only stored a username, not a user ID.
 * @param {string} username
 * @returns {string} Nickname, or the username itself
 */
function getNicknameByUsername(username) {
  return userMemory.findMemoryByUsername(username)?.nickname || username;
}

/**
 * @param {Array<{userId: string, username: string}>} users
 * @returns {Object} Map of userId to nickname
 */
function getNicknames(users) {
  const result = {};
  for (const user of users) {
    result[user.userId] = getNickname(user.userId, user.username);
  }
  return result;
}

module.exports = {
  getNickname,
  getNicknameByUsername,
  getNicknames,
};
