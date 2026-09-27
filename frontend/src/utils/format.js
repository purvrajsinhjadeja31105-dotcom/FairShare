// Display helpers. Amounts are rupees; dates are "YYYY-MM-DD" calendar days or ISO timestamps.

const inr = (fractionDigits) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
});
const whole = inr(0);
const exact = inr(2);

/** ₹1,250 for whole rupees, ₹333.34 otherwise. Always positive: callers say "owe" or "owed". */
export const formatMoney = (amount) => {
    const value = Math.abs(Number(amount) || 0);
    return Number.isInteger(Math.round(value * 100) / 100) ? whole.format(value) : exact.format(value);
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local calendar date as "YYYY-MM-DD" (for date inputs and new expenses). */
export const todayIso = (now = new Date()) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** "12 Sep" (adds the year when it isn't this year). */
export const formatDay = (isoDate, now = new Date()) => {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
    return y === now.getFullYear() ? `${d} ${MONTHS[m - 1]}` : `${d} ${MONTHS[m - 1]} ${y}`;
};

/** "September 2026", used as section headings in activity lists. */
export const monthLabel = (isoDate) => {
    const [y, m] = isoDate.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

/** "just now", "5 min ago", "3 h ago", "yesterday", or a date. */
export const timeAgo = (timestamp, now = new Date()) => {
    const then = new Date(timestamp);
    const seconds = Math.round((now - then) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
    if (seconds < 172800) return 'yesterday';
    return formatDay(todayIso(then), now);
};

/** Plain-words balance: positive = others owe you. */
export const describeBalance = (amount) => {
    const paise = Math.round((Number(amount) || 0) * 100);
    if (paise > 0) return { tone: 'positive', text: `you are owed ${formatMoney(amount)}` };
    if (paise < 0) return { tone: 'negative', text: `you owe ${formatMoney(amount)}` };
    return { tone: 'neutral', text: 'settled up' };
};
