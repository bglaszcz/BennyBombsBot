/**
 * Shared XP rules. `xp` is progress toward the next level; reaching
 * 100 * level² rolls the overflow into the next level.
 */

function levelThreshold(level) {
    return 100 * level * level;
}

/**
 * Add (or remove) XP on a User row in place, carrying overflow through level-ups.
 * Never drops below 0 XP or loses a level. Caller saves the row.
 * @param {Object} user - User model instance
 * @param {number} delta
 * @returns {number} Levels gained
 */
function applyXp(user, delta) {
    const startLevel = user.level;
    user.xp = Math.max(0, user.xp + delta);
    while (user.xp >= levelThreshold(user.level)) {
        user.xp -= levelThreshold(user.level);
        user.level++;
    }
    return user.level - startLevel;
}

module.exports = { levelThreshold, applyXp };
