const { checkExpenseSplits, checkExpenseParticipants, checkSettlement } = require('../services/expenseRules');

describe('checkExpenseSplits', () => {
    test('accepts splits that add up to the total', () => {
        expect(checkExpenseSplits({
            amount: 100,
            splits: [{ userId: 'a', amount_owed: 33.34 }, { userId: 'b', amount_owed: 33.33 }, { userId: 'c', amount_owed: 33.33 }]
        })).toBeNull();
    });

    test('rejects splits that fall short of the total', () => {
        // the old frontend sent 33.33 x 3 for a 100 rupee expense
        expect(checkExpenseSplits({
            amount: 100,
            splits: [{ userId: 'a', amount_owed: 33.33 }, { userId: 'b', amount_owed: 33.33 }, { userId: 'c', amount_owed: 33.33 }]
        })).toMatch(/99\.99.*100\.00/);
    });

    test('rejects splits that exceed the total', () => {
        expect(checkExpenseSplits({ amount: 100, splits: [{ userId: 'a', amount_owed: 500 }] })).not.toBeNull();
    });

    test('rejects negative splits', () => {
        expect(checkExpenseSplits({
            amount: 100,
            splits: [{ userId: 'a', amount_owed: 150 }, { userId: 'b', amount_owed: -50 }]
        })).toMatch(/negative/);
    });

    test('rejects duplicate members', () => {
        expect(checkExpenseSplits({
            amount: 100,
            splits: [{ userId: 'a', amount_owed: 50 }, { userId: 'a', amount_owed: 50 }]
        })).toMatch(/once/);
    });

    test('allows zero-amount entries', () => {
        expect(checkExpenseSplits({
            amount: 10,
            splits: [{ userId: 'a', amount_owed: 10 }, { userId: 'b', amount_owed: 0 }]
        })).toBeNull();
    });
});

describe('checkExpenseParticipants', () => {
    const members = ['a', 'b', 'c'];

    test('accepts members only', () => {
        expect(checkExpenseParticipants({ members, payerId: 'a', splits: [{ userId: 'b' }, { userId: 'c' }] })).toBeNull();
    });

    test('rejects a payer from outside the group', () => {
        expect(checkExpenseParticipants({ members, payerId: 'z', splits: [{ userId: 'a' }] })).toMatch(/payer/);
    });

    test('rejects split participants from outside the group', () => {
        expect(checkExpenseParticipants({ members, payerId: 'a', splits: [{ userId: 'z' }] })).toMatch(/split/);
    });
});

describe('checkSettlement', () => {
    const members = ['a', 'b', 'c'];

    test('payer can record a payment they sent', () => {
        expect(checkSettlement({ members, actingUserId: 'a', fromUserId: 'a', toUserId: 'b' })).toBeNull();
    });

    test('receiver can record a payment they received', () => {
        expect(checkSettlement({ members, actingUserId: 'b', fromUserId: 'a', toUserId: 'b' })).toBeNull();
    });

    test('a third member cannot record a payment between others', () => {
        expect(checkSettlement({ members, actingUserId: 'c', fromUserId: 'a', toUserId: 'b' })).toMatch(/sent or received/);
    });

    test('cannot settle with yourself', () => {
        expect(checkSettlement({ members, actingUserId: 'a', fromUserId: 'a', toUserId: 'a' })).toMatch(/yourself/);
    });

    test('both parties must be members', () => {
        expect(checkSettlement({ members, actingUserId: 'a', fromUserId: 'a', toUserId: 'z' })).toMatch(/members/);
    });
});
