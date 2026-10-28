/**
 * Minimal job runner. Daily/weekly jobs remember their last run date in
 * BotState, so a restart after the scheduled hour doesn't post twice.
 * Recurring jobs simply run on every tick (every 5 minutes).
 */
const { getState, setState } = require('./botState');

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
// A weekly job missed because the bot was down still runs if it comes back within this window
const WEEKLY_CATCH_UP_MS = 24 * 60 * 60 * 1000;
const jobs = [];
const recurringJobs = [];

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
 * @param {(client, scheduledAt: Date) => Promise<void>} job.run - scheduledAt is
 *   when the job was due, which for a caught-up weekly job is earlier than now
 */
function scheduleDaily(job) {
    jobs.push({ ...job, running: false });
}

/**
 * When the job is next due as of `now`, or null if it isn't due.
 * Daily jobs are due from their hour until midnight; weekly jobs from their
 * weekday/hour until WEEKLY_CATCH_UP_MS later.
 */
function getDueTime(job, now) {
    const due = new Date(now);
    due.setHours(job.hour, 0, 0, 0);

    if (job.weekday === undefined) {
        return now >= due ? due : null;
    }

    // Step back to the most recent scheduled weekday at or before now
    due.setDate(due.getDate() - ((now.getDay() - job.weekday + 7) % 7));
    if (due > now) due.setDate(due.getDate() - 7);
    return now - due <= WEEKLY_CATCH_UP_MS ? due : null;
}

/**
 * @param {Object} job
 * @param {string} job.name
 * @param {(client) => Promise<void>} job.run - Runs every tick; must be cheap and idempotent
 */
function scheduleRecurring(job) {
    recurringJobs.push({ ...job, running: false });
}

async function runRecurring(client) {
    for (const job of recurringJobs) {
        if (job.running) continue;
        job.running = true;
        try {
            await job.run(client);
        }
        catch (error) {
            console.error(`Recurring job "${job.name}" failed:`, error);
        }
        finally {
            job.running = false;
        }
    }
}

async function tick(client) {
    const now = new Date();

    for (const job of jobs) {
        if (job.running) continue;
        const due = getDueTime(job, now);
        if (!due) continue;

        job.running = true;
        try {
            // Keyed by the day the job was due, so a caught-up run counts for that day
            const stateKey = `job:${job.name}:lastRun`;
            const dueKey = localDateKey(due);
            if (await getState(stateKey) === dueKey) continue;
            // Mark first so a crash mid-run can't cause a double post on restart
            await setState(stateKey, dueKey);
            await job.run(client, due);
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
    const runAll = () => tick(client).then(() => runRecurring(client));
    setInterval(runAll, CHECK_INTERVAL_MS);
    runAll();
}

module.exports = { scheduleDaily, scheduleRecurring, startScheduler, localDateKey };
