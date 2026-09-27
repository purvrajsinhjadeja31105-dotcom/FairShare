// Expense dates are calendar days ("2026-09-27"), not timestamps: a dinner on the 27th stays on
// the 27th whatever timezone the viewer is in.

// Server default when the client doesn't send a date. India-first app, so "today" is IST.
const todayIso = (now = new Date()) => new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

const isValidIsoDate = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; // rejects 2026-02-30
};

module.exports = { todayIso, isValidIsoDate };
