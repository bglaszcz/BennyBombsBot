// Matches: "Wordle 1,682 4/6*" or "Wordle 1682 X/6"
const WORDLE_REGEX = /Wordle\s+([\d,]+)\s+([X1-6])\/6(\*)?/i;

// Wordle #0 was published on 2021-06-19
const WORDLE_EPOCH_UTC = Date.UTC(2021, 5, 19);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param {string} content
 * @returns {{ wordleNumber: number, score: number, hardMode: boolean } | null}
 *   score is 1-6, or 7 for a failed (X) game
 */
function parseWordleShare(content) {
    const match = content.match(WORDLE_REGEX);
    if (!match) return null;
    return {
        wordleNumber: parseInt(match[1].replace(/,/g, ''), 10),
        score: match[2].toUpperCase() === 'X' ? 7 : parseInt(match[2], 10),
        hardMode: match[3] === '*',
    };
}

/** The Wordle puzzle number for a given local calendar day */
function getWordleNumber(date = new Date()) {
    const localDayUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.round((localDayUtc - WORDLE_EPOCH_UTC) / DAY_MS);
}

/**
 * Streaks break on a loss or a missed puzzle. The current streak only counts
 * if the latest game is today's or yesterday's puzzle.
 * @param {Array<{ wordleNumber: number, score: number }>} scores - Newest first
 */
function calculateStreaks(scores) {
    const ascending = [...scores].reverse();
    let bestStreak = 0;
    let run = 0;
    let previousNumber = null;

    for (const game of ascending) {
        const consecutive = previousNumber !== null && game.wordleNumber === previousNumber + 1;
        if (game.score > 6) {
            run = 0;
        }
        else {
            run = consecutive ? run + 1 : 1;
        }
        bestStreak = Math.max(bestStreak, run);
        previousNumber = game.wordleNumber;
    }

    const latest = scores[0];
    const isRecent = latest && latest.wordleNumber >= getWordleNumber() - 1;
    // `run` ended on the latest game, so it is the current streak if that game is recent
    return { currentStreak: isRecent ? run : 0, bestStreak };
}

module.exports = { WORDLE_REGEX, parseWordleShare, getWordleNumber, calculateStreaks };
