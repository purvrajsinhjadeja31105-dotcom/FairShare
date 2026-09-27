const { z } = require('zod');
const { roundMoney } = require('../utils/money');
const { checkExpenseSplits } = require('../services/expenseRules');
const { isValidIsoDate } = require('../utils/dates');

// Calendar date of the expense, e.g. "2026-09-27"
const expenseDate = z.string().refine(isValidIsoDate, { message: 'Date must be a valid date in YYYY-MM-DD format' });

// Coerces string/number input to a rupee amount rounded to 2 decimals (NaN when unparseable)
const money = z.union([z.number(), z.string()])
    .transform((val) => roundMoney(val));

const positiveAmount = money
    .refine((val) => Number.isFinite(val) && val > 0, { message: 'Amount must be greater than 0' });

const splitSchema = z.object({
    userId: z.string().min(1, 'User ID in split is required'),
    amount_owed: money
        .refine((val) => Number.isFinite(val) && val >= 0, { message: 'Split amount must be a number of 0 or more' })
});

// Splits must add up exactly to the expense total; runs only when both are present
const splitsMatchTotal = (data, ctx) => {
    if (data.amount === undefined || data.splits === undefined) return;
    const problem = checkExpenseSplits(data);
    if (problem) ctx.addIssue({ code: 'custom', path: ['splits'], message: problem });
};

const createExpenseSchema = z.object({
    amount: positiveAmount,
    description: z.string().trim().min(1, 'Description is required').max(255),
    splits: z.array(splitSchema).min(1, 'At least one split is required'),
    paidBy: z.string().optional(),
    date: expenseDate.optional()
}).superRefine(splitsMatchTotal);

const updateExpenseSchema = z.object({
    amount: positiveAmount.optional(),
    description: z.string().trim().min(1, 'Description cannot be empty').max(255).optional(),
    splits: z.array(splitSchema).min(1, 'At least one split is required').optional(),
    paidBy: z.string().min(1).optional(),
    date: expenseDate.optional()
}).superRefine(splitsMatchTotal);

const settleSchema = z.object({
    toUserId: z.string().min(1, 'Recipient user ID is required'),
    fromUserId: z.string().optional(),
    amount: positiveAmount
});

const settlementActionSchema = z.object({
    action: z.enum(['confirm', 'reject'], { message: 'action must be "confirm" or "reject"' })
});

module.exports = {
    settlementActionSchema,
    createExpenseSchema,
    updateExpenseSchema,
    settleSchema
};
