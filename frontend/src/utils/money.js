// Mirrors backend/utils/money.js: math in integer paise so shares always add up to the total.

export const toPaise = (amount) => Math.round(parseFloat(amount) * 100);

/**
 * Splits a rupee amount into `count` shares (as "0.00" strings) that sum exactly to it.
 * Leftover paise go to the first shares: 100 / 3 -> ["33.34", "33.33", "33.33"].
 */
export const splitEvenly = (amount, count) => {
    const total = toPaise(amount);
    if (!Number.isFinite(total) || total <= 0 || count <= 0) return [];

    const base = Math.floor(total / count);
    const remainder = total - base * count;
    return Array.from({ length: count }, (_, i) => ((base + (i < remainder ? 1 : 0)) / 100).toFixed(2));
};
