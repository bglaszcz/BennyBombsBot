/**
 * Head-to-head record between two players on puzzles they both played.
 * @param {Array} scoresA - Player A's rows
 * @param {Array} scoresB - Player B's rows
 * @param {Object} options
 * @param {(row) => string|number} options.keyOf - Puzzle identifier
 * @param {(row) => number} options.valueOf - Score for comparison
 * @param {boolean} options.lowerIsBetter
 * @returns {{ wins: number, losses: number, ties: number, meetings: Array<{ key, a, b }> }}
 *   meetings are newest first
 */
function compareHeadToHead(scoresA, scoresB, { keyOf, valueOf, lowerIsBetter }) {
    const byKeyB = new Map(scoresB.map(row => [keyOf(row), row]));
    const meetings = [];
    let wins = 0;
    let losses = 0;
    let ties = 0;

    for (const rowA of scoresA) {
        const rowB = byKeyB.get(keyOf(rowA));
        if (!rowB) continue;

        const a = valueOf(rowA);
        const b = valueOf(rowB);
        if (a === b) ties++;
        else if ((a < b) === lowerIsBetter) wins++;
        else losses++;

        meetings.push({ key: keyOf(rowA), a, b });
    }

    meetings.sort((x, y) => (x.key < y.key ? 1 : -1));
    return { wins, losses, ties, meetings };
}

/** One-line verdict for the record */
function verdict(nameA, nameB, { wins, losses }) {
    if (wins === losses) return '⚖️ Dead even. Settle it tomorrow.';
    const [leader, trailer, diff] = wins > losses ? [nameA, nameB, wins - losses] : [nameB, nameA, losses - wins];
    if (diff >= 10) return `👑 **${leader}** owns **${trailer}**. It's not close.`;
    return `📈 **${leader}** leads by ${diff}.`;
}

module.exports = { compareHeadToHead, verdict };
