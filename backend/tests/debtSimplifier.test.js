const { simplifyDebts } = require('../services/debtSimplifier');
const { toPaise } = require('../utils/money');

const names = { a: 'Asha', b: 'Bala', c: 'Chen', d: 'Dev' };

// Applies the transactions to the balances (in paise); every balance should end at zero
const settle = (balances, transactions) => {
    const result = Object.fromEntries(Object.entries(balances).map(([id, v]) => [id, toPaise(v)]));
    for (const t of transactions) {
        result[t.fromUserId] += toPaise(t.amount);
        result[t.toUserId] -= toPaise(t.amount);
    }
    return result;
};

describe('simplifyDebts', () => {
    test('returns nothing when everyone is settled', () => {
        expect(simplifyDebts({ a: 0, b: 0 }, names)).toEqual([]);
        expect(simplifyDebts({}, names)).toEqual([]);
    });

    test('single debt becomes one transaction', () => {
        expect(simplifyDebts({ a: 50, b: -50 }, names)).toEqual([
            { fromUserId: 'b', fromUserName: 'Bala', toUserId: 'a', toUserName: 'Asha', amount: 50 }
        ]);
    });

    test('collapses a chain into one payment', () => {
        // c owes b 30 and b owes a 30 => net: a +30, b 0, c -30
        const tx = simplifyDebts({ a: 30, b: 0, c: -30 }, names);
        expect(tx).toHaveLength(1);
        expect(tx[0]).toMatchObject({ fromUserId: 'c', toUserId: 'a', amount: 30 });
    });

    test('uses at most n - 1 transactions and settles every balance', () => {
        const balances = { a: 120.5, b: -40.25, c: -60.25, d: -20 };
        const tx = simplifyDebts(balances, names);
        expect(tx.length).toBeLessThanOrEqual(3);
        Object.values(settle(balances, tx)).forEach(v => expect(v).toBe(0));
    });

    test('handles float-prone amounts without leaving dust', () => {
        const balances = { a: 0.1 + 0.2, b: -0.1, c: -0.2 };
        const tx = simplifyDebts(balances, names);
        expect(tx.map(t => t.amount).sort()).toEqual([0.1, 0.2]);
        Object.values(settle(balances, tx)).forEach(v => expect(v).toBe(0));
    });

    test('settles one-paisa balances instead of ignoring them', () => {
        expect(simplifyDebts({ a: 0.01, b: -0.01 }, names)).toHaveLength(1);
    });

    test('falls back to "Unknown User" for missing names', () => {
        const [t] = simplifyDebts({ x: 10, y: -10 }, {});
        expect(t.fromUserName).toBe('Unknown User');
    });
});
