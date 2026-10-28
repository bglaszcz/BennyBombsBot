/**
 * Parse a casual date/time into a Date, in server-local time. Accepts:
 *   relative:  "30m", "6h", "3d", "1w"
 *   days:      "today", "tonight", "tomorrow", "friday", "next fri"
 *   dates:     "2026-11-03", "11/3", "11/3/2026"
 *   any of the day/date forms + a time: "friday 6pm", "11/3 18:30", "tomorrow at 9am"
 * A day without a time means 9pm. Returns null if it can't make sense of it.
 */
const DEFAULT_HOUR = 21;
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const UNIT_MS = { m: 60e3, h: 3600e3 };

/** "6pm", "6:30 pm", "18:00", "noon", "midnight" → [hours, minutes] */
function parseTime(text) {
    if (!text) return null;
    if (text === 'noon') return [12, 0];
    if (text === 'midnight') return [23, 59];
    const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2] ?? 0);
    const meridiem = match[3];
    if (!meridiem && !match[2]) return null;
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) return null;
    return [hours, minutes];
}

/** The day part → a Date at midnight, or null */
function parseDay(text, now) {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const plusDays = n => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);

    if (text === 'today' || text === 'tonight') return today;
    if (text === 'tomorrow') return plusDays(1);

    const weekday = text.replace(/^next\s+/, '').slice(0, 3);
    const index = WEEKDAYS.indexOf(weekday);
    if (index !== -1 && /^(next\s+)?[a-z]+$/.test(text)) {
        // Today's weekday means next week's
        return plusDays((index - today.getDay() + 7) % 7 || 7);
    }

    let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

    match = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if (match) {
        const year = match[3] ? Number(match[3].length === 2 ? `20${match[3]}` : match[3]) : today.getFullYear();
        const date = new Date(year, Number(match[1]) - 1, Number(match[2]));
        // No year and already passed: they mean next year
        if (!match[3] && date < today) date.setFullYear(year + 1);
        return date;
    }
    return null;
}

function parseWhen(input, now = new Date()) {
    const text = input.trim().toLowerCase().replace(/\s+/g, ' ').replace(/,/g, '');

    const relative = text.match(/^(\d+)\s*(m|mins?|minutes?|h|hrs?|hours?|d|days?|w|wks?|weeks?)$/);
    if (relative) {
        const amount = Number(relative[1]);
        const unit = relative[2][0];
        if (unit === 'm' || unit === 'h') return new Date(now.getTime() + amount * UNIT_MS[unit]);
        // Days and weeks go by the calendar so "3d" keeps the same clock time across DST
        const date = new Date(now);
        date.setDate(date.getDate() + amount * (unit === 'w' ? 7 : 1));
        return date;
    }

    // Split "friday at 6pm" / "11/3 18:00" into day and time
    const match = text.match(/^(.+?)(?:\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?|noon|midnight))?$/);
    if (!match) return null;
    const day = parseDay(match[1], now);
    if (!day) {
        // Just a time: today, or tomorrow if it's already passed
        const timeOnly = parseTime(text.replace(/^at\s+/, ''));
        if (!timeOnly) return null;
        const date = new Date(now);
        date.setHours(timeOnly[0], timeOnly[1], 0, 0);
        if (date <= now) date.setDate(date.getDate() + 1);
        return date;
    }

    const time = match[2] ? parseTime(match[2]) : [DEFAULT_HOUR, 0];
    if (!time) return null;
    day.setHours(time[0], time[1], 0, 0);
    return day;
}

module.exports = { parseWhen };
