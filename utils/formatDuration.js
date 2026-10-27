/**
 * Human-readable duration, e.g. "3d 4h 12m" or "45s".
 * @param {number} ms
 * @param {number} [maxUnits] - How many units to show, largest first
 */
function formatDuration(ms, maxUnits = 3) {
    const units = [
        ['d', 24 * 60 * 60 * 1000],
        ['h', 60 * 60 * 1000],
        ['m', 60 * 1000],
        ['s', 1000],
    ];

    const parts = [];
    let remaining = Math.max(0, ms);
    for (const [label, size] of units) {
        const value = Math.floor(remaining / size);
        remaining -= value * size;
        if (value > 0) parts.push(`${value}${label}`);
        if (parts.length === maxUnits) break;
    }
    return parts.length > 0 ? parts.join(' ') : '0s';
}

module.exports = { formatDuration };
