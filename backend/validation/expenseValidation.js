const { z } = require('zod');

// Helper to coerce string amounts to numbers and validate positivity
const positiveAmount = z.union([z.number(), z.string()])
    .transform((val) => {
        const parsed = parseFloat(val);
        return isNaN(parsed) ? 0 : parsed;
    })
    .refine((val) => val > 0, { message: 'Amount must be greater than 0' });

const splitSchema = z.object({
    userId: z.string().min(1, 'User ID in split is required'),
    amount_owed: z.union([z.number(), z.string()])
        .transform((val) => {
            const parsed = parseFloat(val);
            return isNaN(parsed) ? 0 : parsed;
        })
});

const createExpenseSchema = z.object({
    amount: positiveAmount,
    description: z.string().trim().min(1, 'Description is required').max(255),
    splits: z.array(splitSchema).min(1, 'At least one split is required'),
    paidBy: z.string().optional()
});

const updateExpenseSchema = z.object({
    amount: positiveAmount.optional(),
    description: z.string().trim().min(1, 'Description cannot be empty').max(255).optional(),
    splits: z.array(splitSchema).optional()
});

const markWrongSchema = z.object({
    isWrong: z.boolean({ required_error: 'isWrong boolean status is required' })
});

const settleSchema = z.object({
    toUserId: z.string().min(1, 'Recipient user ID is required'),
    fromUserId: z.string().optional(),
    amount: positiveAmount
});

module.exports = {
    createExpenseSchema,
    updateExpenseSchema,
    markWrongSchema,
    settleSchema
};
