// Mirrors backend/utils/money.js: math in integer paise so shares always add up to the total.

export const toPaise = (amount) => Math.round(parseFloat(amount) * 100);
export const fromPaise = (paise) => paise / 100;

/** Distributes `leftover` paise one at a time to the first shares, so the total is exact. */
const distribute = (baseShares, leftover) => baseShares.map((share, i) => share + (i < leftover ? 1 : 0));

/**
 * Splits a rupee amount into `count` shares (as "0.00" strings) that sum exactly to it.
 * Leftover paise go to the first shares: 100 / 3 -> ["33.34", "33.33", "33.33"].
 */
export const splitEvenly = (amount, count) => {
    const total = toPaise(amount);
    if (!Number.isFinite(total) || total <= 0 || count <= 0) return [];

    const base = Math.floor(total / count);
    return distribute(Array(count).fill(base), total - base * count).map(p => (p / 100).toFixed(2));
};

/**
 * Splits a rupee amount by percentages that must add up to 100. Uses the largest-remainder method
 * so the shares add up to the exact total: ₹100 at 33.33/33.33/33.34 -> 33.33 + 33.33 + 33.34.
 * Returns null when the percentages don't add up to 100.
 */
export const splitByPercent = (amount, percents) => {
    const total = toPaise(amount);
    const pct = percents.map(p => parseFloat(p) || 0);
    if (!Number.isFinite(total) || total <= 0 || Math.round(pct.reduce((a, b) => a + b, 0) * 100) !== 10000) return null;

    const exact = pct.map(p => (total * p) / 100);
    const floors = exact.map(Math.floor);
    let leftover = total - floors.reduce((a, b) => a + b, 0);
    const order = exact.map((value, i) => ({ i, rest: value - floors[i] })).sort((a, b) => b.rest - a.rest);
    for (const { i } of order) {
        if (leftover <= 0) break;
        floors[i] += 1;
        leftover -= 1;
    }
    return floors.map(p => (p / 100).toFixed(2));
};

/** Sum of rupee values (strings or numbers) in paise; blanks count as 0. */
export const sumPaise = (values) => values.reduce((sum, v) => sum + (toPaise(v || 0) || 0), 0);
