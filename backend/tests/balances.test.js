const { groupBalancesPaise, summarizeGroup, buildOverview } = require('../services/balances');
const { createInviteCode, isValidInviteCode } = require('../utils/inviteCode');
const { todayIso, isValidIsoDate } = require('../utils/dates');

const names = { a: 'Asha', b: 'Bala', c: 'Chen' };
const expense = (paid_by, splits, extra = {}) => ({
    id: `${paid_by}-${Math.random()}`, type: 'expense', paid_by, is_wrong: false,
    splits: Object.entries(splits).map(([userId, amount_owed]) => ({ userId, amount_owed })), ...extra
});
const settlement = (from, to, amount, status) => ({
    id: `s-${Math.random()}`, type: 'settlement', settlement_status: status, paid_by: from, to_user_id: to, amount,
    splits: [{ userId: to, amount_owed: amount }], is_wrong: false
});

describe('groupBalancesPaise', () => {
    test('credits the payer and debits each participant; sums to zero', () => {
        const balances = groupBalancesPaise([expense('a', { a: 100, b: 100, c: 100 })]);
        expect(balances).toEqual({ a: 20000, b: -10000, c: -10000 });
        expect(Object.values(balances).reduce((x, y) => x + y, 0)).toBe(0);
    });

    test('ignores deleted entries and unconfirmed payments', () => {
        const balances = groupBalancesPaise([
            expense('a', { a: 50, b: 50 }),
            expense('a', { a: 50, b: 50 }, { deleted_at: new Date() }),
            settlement('b', 'a', 50, 'pending'),
            settlement('b', 'a', 50, 'rejected')
        ]);
        expect(balances).toEqual({ a: 5000, b: -5000 });
    });
});

describe('summarizeGroup', () => {
    test('returns rupee balances and the suggested payments', () => {
        const { balances, simplifiedDebts } = summarizeGroup([expense('a', { a: 100, b: 100, c: 100 })], names);
        expect(balances).toEqual({ a: 200, b: -100, c: -100 });
        expect(simplifiedDebts).toHaveLength(2);
        expect(simplifiedDebts.every(d => d.toUserId === 'a' && d.amount === 100)).toBe(true);
    });
});

describe('buildOverview', () => {
    const trip = { id: 'g1', name: 'Goa', members: ['a', 'b', 'c'], entries: [expense('a', { a: 100, b: 100, c: 100 })] };
    const flat = { id: 'g2', name: 'Flat', members: ['a', 'b'], entries: [expense('b', { a: 40, b: 40 })] };

    test('totals your balance across groups and lists each group', () => {
        const overview = buildOverview('a', [trip, flat], names);
        expect(overview.total).toBe(160); // +200 in Goa, -40 in Flat
        expect(overview.groups).toEqual([
            { id: 'g1', name: 'Goa', member_count: 3, my_balance: 200 },
            { id: 'g2', name: 'Flat', member_count: 2, my_balance: -40 }
        ]);
    });

    test('people balances come from each group\'s suggested payments, with a per-group breakdown', () => {
        const { people } = buildOverview('a', [trip, flat], names);
        const bala = people.find(p => p.userId === 'b');
        expect(bala.balance).toBe(60); // owes Asha 100 in Goa, Asha owes Bala 40 in Flat
        expect(bala.groups).toEqual([
            { groupId: 'g1', groupName: 'Goa', amount: 100 },
            { groupId: 'g2', groupName: 'Flat', amount: -40 }
        ]);
        expect(people.find(p => p.userId === 'c')).toMatchObject({ username: 'Chen', balance: 100 });
    });

    test('keeps a person whose debts in different groups cancel out (each group still needs settling)', () => {
        const g3 = { id: 'g3', name: 'Lunch', members: ['a', 'b'], entries: [expense('b', { a: 100, b: 0 })] };
        const g4 = { id: 'g4', name: 'Movie', members: ['a', 'b'], entries: [expense('a', { a: 0, b: 100 })] };
        const bala = buildOverview('a', [g3, g4], names).people.find(p => p.userId === 'b');
        expect(bala.balance).toBe(0);
        expect(bala.groups).toHaveLength(2);
    });

    test('lists pending payments in both directions', () => {
        const g = { id: 'g1', name: 'Goa', members: ['a', 'b', 'c'], entries: [
            expense('a', { a: 100, b: 100, c: 100 }),
            settlement('b', 'a', 100, 'pending'),
            settlement('a', 'c', 5, 'pending'),
            settlement('c', 'a', 20, 'confirmed')
        ] };
        const { pendingForYou, pendingByYou } = buildOverview('a', [g], names);
        expect(pendingForYou).toEqual([expect.objectContaining({ fromUserId: 'b', fromUserName: 'Bala', amount: 100, groupName: 'Goa' })]);
        expect(pendingByYou).toEqual([expect.objectContaining({ toUserId: 'c', toUserName: 'Chen', amount: 5 })]);
    });

    test('someone with no groups is all settled', () => {
        expect(buildOverview('a', [], names)).toEqual({ total: 0, people: [], groups: [], pendingForYou: [], pendingByYou: [] });
    });
});

describe('invite codes', () => {
    test('are 12 unambiguous URL-safe characters and unique', () => {
        const codes = new Set(Array.from({ length: 200 }, () => createInviteCode()));
        expect(codes.size).toBe(200);
        codes.forEach(code => expect(isValidInviteCode(code)).toBe(true));
    });

    test('rejects malformed codes', () => {
        ['', 'short', 'O0lI1O0lI1O0', 'abc/def?ghij', null, 123].forEach(code => expect(isValidInviteCode(code)).toBe(false));
    });
});

describe('expense dates', () => {
    test('validates real calendar dates only', () => {
        expect(isValidIsoDate('2026-09-27')).toBe(true);
        expect(isValidIsoDate('2026-02-30')).toBe(false);
        expect(isValidIsoDate('27-09-2026')).toBe(false);
        expect(isValidIsoDate(undefined)).toBe(false);
    });

    test('today is the Indian calendar date', () => {
        // 20:00 UTC on the 26th is 01:30 IST on the 27th
        expect(todayIso(new Date('2026-09-26T20:00:00Z'))).toBe('2026-09-27');
        expect(todayIso(new Date('2026-09-26T10:00:00Z'))).toBe('2026-09-26');
    });
});
