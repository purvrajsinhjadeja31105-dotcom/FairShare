const { SETTLEMENT_STATUS, isSettlement, settlementStatus, countsTowardBalance, settlementReceiver } = require('../services/ledger');
const { diffFields } = require('../services/auditLog');

const expense = (extra = {}) => ({ type: 'expense', description: 'Dinner', is_wrong: false, splits: [{ userId: 'b', amount_owed: 10 }], ...extra });
const settlement = (extra = {}) => ({ type: 'settlement', description: 'Settlement Payment to Bala', is_wrong: false, splits: [{ userId: 'b', amount_owed: 10 }], ...extra });

describe('isSettlement', () => {
    test('uses the type field', () => {
        expect(isSettlement(settlement())).toBe(true);
        expect(isSettlement(expense())).toBe(false);
    });

    test('recognises settlements created before the type field existed', () => {
        expect(isSettlement({ description: 'Settlement Payment to Asha' })).toBe(true);
        expect(isSettlement({ description: 'Dinner at the settlement cafe' })).toBe(false);
    });
});

describe('countsTowardBalance', () => {
    test('normal expenses count; deleted or wrong ones do not', () => {
        expect(countsTowardBalance(expense())).toBe(true);
        expect(countsTowardBalance(expense({ deleted_at: new Date() }))).toBe(false);
        expect(countsTowardBalance(expense({ is_wrong: true }))).toBe(false);
    });

    test('only confirmed settlements count', () => {
        expect(countsTowardBalance(settlement({ settlement_status: SETTLEMENT_STATUS.CONFIRMED }))).toBe(true);
        expect(countsTowardBalance(settlement({ settlement_status: SETTLEMENT_STATUS.PENDING }))).toBe(false);
        expect(countsTowardBalance(settlement({ settlement_status: SETTLEMENT_STATUS.REJECTED }))).toBe(false);
    });

    test('legacy settlements without a status keep counting (they always did)', () => {
        const legacy = { description: 'Settlement Payment to Asha', is_wrong: false };
        expect(settlementStatus(legacy)).toBe(SETTLEMENT_STATUS.CONFIRMED);
        expect(countsTowardBalance(legacy)).toBe(true);
    });

    test('a deleted confirmed settlement does not count', () => {
        expect(countsTowardBalance(settlement({ settlement_status: 'confirmed', deleted_at: new Date() }))).toBe(false);
    });
});

describe('settlementReceiver', () => {
    test('prefers to_user_id and falls back to the single split', () => {
        expect(settlementReceiver(settlement({ to_user_id: 'x' }))).toBe('x');
        expect(settlementReceiver(settlement())).toBe('b');
    });
});

describe('diffFields', () => {
    test('reports only fields that changed', () => {
        const before = { amount: 90, description: 'Dinner', splits: [{ userId: 'a', amount_owed: 90 }] };
        const after = { amount: 90, description: 'Dinner at Thalassa' };
        expect(diffFields(before, after, ['amount', 'description', 'splits'])).toEqual({
            description: { from: 'Dinner', to: 'Dinner at Thalassa' }
        });
    });

    test('detects changed nested splits', () => {
        const changes = diffFields(
            { splits: [{ userId: 'a', amount_owed: 10 }] },
            { splits: [{ userId: 'a', amount_owed: 12 }] },
            ['splits']
        );
        expect(Object.keys(changes)).toEqual(['splits']);
    });
});
