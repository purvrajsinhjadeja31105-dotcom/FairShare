import { describe, expect, test } from 'vitest';
import { splitByPercent, splitEvenly, sumPaise, toPaise } from './money';
import { computeSplit } from './split';
import { describeBalance, formatDay, formatMoney, todayIso } from './format';
import { buildUpiLink } from './upi';
import { myEffect, pendingPayments } from './entries';

const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
const sumShares = (shares) => Object.values(shares).reduce((sum, v) => sum + toPaise(v), 0);

describe('money', () => {
    test('equal split gives leftover paise to the first people', () => {
        expect(splitEvenly(100, 3)).toEqual(['33.34', '33.33', '33.33']);
        expect(splitEvenly('0.02', 3)).toEqual(['0.01', '0.01', '0.00']);
        expect(splitEvenly(0, 3)).toEqual([]);
    });

    test('percent split always adds up to the exact total', () => {
        expect(splitByPercent(100, [33.33, 33.33, 33.34])).toEqual(['33.33', '33.33', '33.34']);
        const shares = splitByPercent(999.99, [50, 25, 25]);
        expect(shares.reduce((s, v) => s + toPaise(v), 0)).toBe(99999);
    });

    test('percent split rejects percentages that do not total 100', () => {
        expect(splitByPercent(100, [50, 40])).toBeNull();
        expect(splitByPercent(100, [60, 50])).toBeNull();
    });

    test('sumPaise ignores blanks', () => {
        expect(sumPaise(['10.50', '', undefined, '0.25'])).toBe(1075);
    });
});

describe('computeSplit', () => {
    test('equally among ticked people only', () => {
        const result = computeSplit({ mode: 'equal', amount: '90', members, included: { a: true, b: true, c: false }, values: {} });
        expect(result.valid).toBe(true);
        expect(result.shares).toEqual({ a: '45.00', b: '45.00' });
        expect(result.message).toMatch(/₹45 each/);
    });

    test('equally needs at least one person and an amount', () => {
        expect(computeSplit({ mode: 'equal', amount: '90', members, included: {}, values: {} }).valid).toBe(false);
        expect(computeSplit({ mode: 'equal', amount: '', members, included: { a: true }, values: {} }).valid).toBe(false);
    });

    test('exact amounts must add up, and say how much is left', () => {
        const partial = computeSplit({ mode: 'exact', amount: '100', members, included: {}, values: { a: '60', b: '30' } });
        expect(partial.valid).toBe(false);
        expect(partial.message).toBe('₹10 left to assign');

        const over = computeSplit({ mode: 'exact', amount: '100', members, included: {}, values: { a: '60', b: '50' } });
        expect(over.message).toBe('₹10 too much');

        const done = computeSplit({ mode: 'exact', amount: '100', members, included: {}, values: { a: '60', b: '40', c: '' } });
        expect(done.valid).toBe(true);
        expect(done.shares).toEqual({ a: '60.00', b: '40.00' });
    });

    test('percent shares add up to the total', () => {
        const result = computeSplit({ mode: 'percent', amount: '100', members, included: {}, values: { a: '33.33', b: '33.33', c: '33.34' } });
        expect(result.valid).toBe(true);
        expect(sumShares(result.shares)).toBe(10000);
    });

    test('percent that does not reach 100 is invalid', () => {
        const result = computeSplit({ mode: 'percent', amount: '100', members, included: {}, values: { a: '50', b: '30' } });
        expect(result.valid).toBe(false);
        expect(result.message).toBe('80% of 100%');
    });
});

describe('format', () => {
    test('rupees in Indian format, decimals only when needed', () => {
        expect(formatMoney(1250)).toBe('₹1,250');
        expect(formatMoney(125000)).toBe('₹1,25,000');
        expect(formatMoney(333.34)).toBe('₹333.34');
        expect(formatMoney(-40)).toBe('₹40');
    });

    test('days show the year only when it is not this year', () => {
        const now = new Date(2026, 8, 27);
        expect(formatDay('2026-09-12', now)).toBe('12 Sep');
        expect(formatDay('2025-12-31', now)).toBe('31 Dec 2025');
        expect(todayIso(now)).toBe('2026-09-27');
    });

    test('balances in plain words', () => {
        expect(describeBalance(25)).toEqual({ tone: 'positive', text: 'you are owed ₹25' });
        expect(describeBalance(-25)).toEqual({ tone: 'negative', text: 'you owe ₹25' });
        expect(describeBalance(0.001)).toEqual({ tone: 'neutral', text: 'settled up' });
    });
});

describe('UPI link', () => {
    test('follows the upi://pay format with encoded values', () => {
        expect(buildUpiLink({ upiId: 'asha@okaxis', name: 'Asha K', amount: 333.3 }))
            .toBe('upi://pay?pa=asha%40okaxis&pn=Asha%20K&am=333.30&cu=INR&tn=FairShare%20settle%20up');
    });
});

describe('myEffect', () => {
    const entry = { type: 'expense', paid_by: 'a', amount: 300, splits: [{ userId: 'a', amount: 100 }, { userId: 'b', amount: 200 }] };

    test('payer lent everything except their own share', () => {
        expect(myEffect(entry, 'a')).toEqual({ tone: 'positive', label: 'you lent', amount: 200 });
    });

    test('participants borrowed their share; others are not involved', () => {
        expect(myEffect(entry, 'b')).toEqual({ tone: 'negative', label: 'you borrowed', amount: 200 });
        expect(myEffect(entry, 'c')).toEqual({ tone: 'neutral', label: 'not involved', amount: null });
    });

    test('payments have no lent/borrowed line', () => {
        expect(myEffect({ ...entry, type: 'settlement' }, 'a')).toBeNull();
    });
});

describe('pendingPayments', () => {
    const payment = (id, from, to, status, created_at) => ({
        id, type: 'settlement', settlement_status: status, amount: 100, paid_by: from, paid_by_name: from,
        splits: [{ userId: to, username: to }], created_at
    });
    const entries = [
        payment('p1', 'bala', 'asha', 'pending', '2026-09-20T10:00:00Z'),
        payment('p2', 'chen', 'asha', 'pending', '2026-09-01T10:00:00Z'),
        payment('p3', 'asha', 'chen', 'pending', '2026-09-10T10:00:00Z'),
        payment('p4', 'bala', 'asha', 'confirmed', '2026-09-05T10:00:00Z'),
        payment('p5', 'bala', 'chen', 'pending', '2026-09-05T10:00:00Z'),
        { id: 'e1', type: 'expense', paid_by: 'asha', splits: [], created_at: '2026-09-02T10:00:00Z' }
    ];

    test('lists only pending payments you receive (oldest first) or sent', () => {
        const { forYou, byYou } = pendingPayments(entries, 'asha', 'Goa');
        expect(forYou.map(p => p.id)).toEqual(['p2', 'p1']);
        expect(byYou.map(p => p.id)).toEqual(['p3']);
        expect(forYou[0]).toMatchObject({ fromUserName: 'chen', toUserName: 'asha', amount: 100, groupName: 'Goa' });
    });

    test('payments between other people are not shown to you', () => {
        const { forYou, byYou } = pendingPayments(entries, 'asha', 'Goa');
        expect([...forYou, ...byYou].some(p => p.id === 'p5')).toBe(false);
    });
});
