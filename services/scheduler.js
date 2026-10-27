/**
 * Minimal daily/weekly job runner. Each job remembers its last run date in
 * BotState, so a restart after the scheduled hour doesn't post twice.
 */
const { getState, setState } = require('./botState');

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const jobs = [];

function localDateKey(date = new Date()) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

/**
 * @param {Object} job
 * @param {string} job.name - Unique key used to remember the last run
 * @param {number} job.hour - Earliest local hour (0-23) to run
 * @param {number} [job.weekday] - Only run on this day (0 = Sunday)
 * @param {(client) => Promise<void>} job.run
 */
function scheduleDaily(job) {
    jobs.push({ ...job, running: false });
}

async function tick(client) {
    const now = new Date();
    const today = localDateKey(now);

    for (const job of jobs) {
        if (job.running) continue;
        if (now.getHours() < job.hour) continue;
        if (job.weekday !== undefined && now.getDay() !== job.weekday) continue;

        job.running = true;
        try {
            const stateKey = `job:${job.name}:lastRun`;
            if (await getState(stateKey) === today) continue;
            // Mark first so a crash mid-run can't cause a double post on restart
            await setState(stateKey, today);
            await job.run(client);
        }
        catch (error) {
            console.error(`Scheduled job "${job.name}" failed:`, error);
        }
        finally {
            job.running = false;
        }
    }
}

function startScheduler(client) {
    setInterval(() => tick(client), CHECK_INTERVAL_MS);
    tick(client);
}

module.exports = { scheduleDaily, startScheduler, localDateKey };
