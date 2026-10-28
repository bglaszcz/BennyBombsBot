/**
 * Day key used by the GMC, GAC and GAC bet tables, e.g. "10/27/2026".
 * The locale is pinned so the format can't drift if Node's default locale
 * changes — existing rows were all written in en-US format.
 * @param {Date} [date]
 * @returns {string}
 */
function dayKey(date = new Date()) {
    return date.toLocaleDateString('en-US');
}

module.exports = { dayKey };
