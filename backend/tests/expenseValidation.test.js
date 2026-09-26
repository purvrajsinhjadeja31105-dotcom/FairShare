const { createExpenseSchema, updateExpenseSchema, settleSchema } = require('../validation/expenseValidation');

describe('createExpenseSchema', () => {
    test('parses string amounts and rounds to paise', () => {
        const result = createExpenseSchema.parse({
            amount: '100.004',
            description: '  Dinner  ',
            splits: [{ userId: 'a', amount_owed: '50' }, { userId: 'b', amount_owed: 50.001 }]
        });
        expect(result.amount).toBe(100);
        expect(result.description).toBe('Dinner');
        expect(result.splits.map(s => s.amount_owed)).toEqual([50, 50]);
    });

    test('rejects splits that do not add up to the amount', () => {
        const result = createExpenseSchema.safeParse({
            amount: 100,
            description: 'Dinner',
            splits: [{ userId: 'a', amount_owed: 40 }]
        });
        expect(result.success).toBe(false);
        expect(result.error.issues[0].message).toMatch(/add up/);
    });

    test('rejects zero, negative and non-numeric amounts', () => {
        for (const amount of [0, -5, 'abc']) {
            const result = createExpenseSchema.safeParse({ amount, description: 'x', splits: [{ userId: 'a', amount_owed: 1 }] });
            expect(result.success).toBe(false);
        }
    });

    test('rejects non-numeric split amounts', () => {
        const result = createExpenseSchema.safeParse({ amount: 10, description: 'x', splits: [{ userId: 'a', amount_owed: 'ten' }] });
        expect(result.success).toBe(false);
    });

    test('requires a description and at least one split', () => {
        expect(createExpenseSchema.safeParse({ amount: 10, description: ' ', splits: [{ userId: 'a', amount_owed: 10 }] }).success).toBe(false);
        expect(createExpenseSchema.safeParse({ amount: 10, description: 'x', splits: [] }).success).toBe(false);
    });
});

describe('updateExpenseSchema', () => {
    test('allows partial updates', () => {
        expect(updateExpenseSchema.parse({ description: 'Renamed' })).toEqual({ description: 'Renamed' });
    });

    test('checks totals when amount and splits are both sent', () => {
        expect(updateExpenseSchema.safeParse({ amount: 20, splits: [{ userId: 'a', amount_owed: 10 }] }).success).toBe(false);
        expect(updateExpenseSchema.safeParse({ amount: 20, splits: [{ userId: 'a', amount_owed: 20 }] }).success).toBe(true);
    });
});

describe('settleSchema', () => {
    test('requires a recipient and a positive amount', () => {
        expect(settleSchema.safeParse({ toUserId: 'b', amount: '25.50' }).data).toEqual({ toUserId: 'b', amount: 25.5 });
        expect(settleSchema.safeParse({ toUserId: '', amount: 10 }).success).toBe(false);
        expect(settleSchema.safeParse({ toUserId: 'b', amount: 0 }).success).toBe(false);
    });
});
