import { formatMoney } from './format';
import { fromPaise, splitByPercent, splitEvenly, sumPaise, toPaise } from './money';

/** Works out each person's share for the chosen mode, and whether the split is complete. */
export const computeSplit = ({ mode, amount, members, included, values }) => {
    const totalPaise = toPaise(amount);
    if (!Number.isFinite(totalPaise) || totalPaise <= 0) return { shares: {}, valid: false, message: 'Enter an amount' };

    if (mode === 'equal') {
        const people = members.filter(m => included[m.id]);
        if (people.length === 0) return { shares: {}, valid: false, message: 'Choose who shares this' };
        const parts = splitEvenly(amount, people.length);
        const shares = Object.fromEntries(people.map((m, i) => [m.id, parts[i]]));
        const each = new Set(parts).size === 1 ? `${formatMoney(parts[0])} each` : `about ${formatMoney(parts[0])} each`;
        return { shares, valid: true, message: `${each} · ${people.length} ${people.length === 1 ? 'person' : 'people'}` };
    }

    if (mode === 'exact') {
        const assigned = sumPaise(members.map(m => values[m.id]));
        const left = totalPaise - assigned;
        const shares = Object.fromEntries(members.filter(m => toPaise(values[m.id] || 0) > 0).map(m => [m.id, (toPaise(values[m.id]) / 100).toFixed(2)]));
        if (left === 0) return { shares, valid: Object.keys(shares).length > 0, message: 'Amounts add up' };
        return { shares, valid: false, message: left > 0 ? `${formatMoney(fromPaise(left))} left to assign` : `${formatMoney(fromPaise(-left))} too much` };
    }

    // percent
    const people = members.filter(m => parseFloat(values[m.id]) > 0);
    const pctTotal = Math.round(people.reduce((sum, m) => sum + parseFloat(values[m.id]), 0) * 100) / 100;
    const parts = people.length ? splitByPercent(amount, people.map(m => values[m.id])) : null;
    if (!parts) return { shares: {}, valid: false, message: `${pctTotal}% of 100%` };
    return { shares: Object.fromEntries(people.map((m, i) => [m.id, parts[i]])), valid: true, message: 'Percentages add up to 100%' };
};
