/**
 * Money helpers. All arithmetic is done in integer paise (1/100 of a rupee)
 * so that sums never drift the way floating point rupees do (0.1 + 0.2 !== 0.3).
 * Amounts are still stored in Firestore as rupees rounded to 2 decimals.
 */

const toPaise = (amount) => {
    const value = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (!Number.isFinite(value)) return NaN;
    return Math.round(value * 100);
};

const fromPaise = (paise) => paise / 100;

/** Rounds a rupee amount to exactly 2 decimals. */
const roundMoney = (amount) => fromPaise(toPaise(amount));

/**
 * Splits a total into `count` shares that add up exactly to the total.
 * Leftover paise go to the first shares: 10000 / 3 -> [3334, 3333, 3333].
 */
const splitEvenly = (totalPaise, count) => {
    if (!Number.isInteger(totalPaise) || totalPaise < 0) throw new Error('totalPaise must be a non-negative integer');
    if (!Number.isInteger(count) || count <= 0) throw new Error('count must be a positive integer');

    const base = Math.floor(totalPaise / count);
    const remainder = totalPaise - base * count;
    return Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
};

module.exports = { toPaise, fromPaise, roundMoney, splitEvenly };
