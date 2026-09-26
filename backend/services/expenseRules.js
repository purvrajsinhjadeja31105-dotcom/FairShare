/**
 * Pure business rules for expenses and settlements.
 * Kept free of Firestore/Express so they can be unit tested directly.
 * Each check returns an error message string, or null when the input is valid.
 */
const { toPaise } = require('../utils/money');

const checkExpenseSplits = ({ amount, splits }) => {
    const totalPaise = toPaise(amount);
    let splitPaise = 0;
    const seen = new Set();

    for (const split of splits) {
        const owedPaise = toPaise(split.amount_owed);
        if (!Number.isFinite(owedPaise) || owedPaise < 0) {
            return 'Split amounts cannot be negative';
        }
        if (seen.has(split.userId)) {
            return 'Each member can only appear once in the splits';
        }
        seen.add(split.userId);
        splitPaise += owedPaise;
    }

    if (splitPaise !== totalPaise) {
        return `Splits add up to ${(splitPaise / 100).toFixed(2)} but the expense total is ${(totalPaise / 100).toFixed(2)}`;
    }
    return null;
};

const checkExpenseParticipants = ({ members, payerId, splits }) => {
    if (!members.includes(payerId)) {
        return 'The payer must be a member of this group';
    }
    if (splits.some(s => !members.includes(s.userId))) {
        return 'Every person in the split must be a member of this group';
    }
    return null;
};

const checkSettlement = ({ members, actingUserId, fromUserId, toUserId }) => {
    if (fromUserId === toUserId) {
        return 'You cannot settle a payment with yourself';
    }
    if (!members.includes(fromUserId) || !members.includes(toUserId)) {
        return 'Both people in a settlement must be members of this group';
    }
    // You may record a payment you sent, or one you received — never one between two other people.
    if (actingUserId !== fromUserId && actingUserId !== toUserId) {
        return 'You can only record settlements that you sent or received';
    }
    return null;
};

module.exports = { checkExpenseSplits, checkExpenseParticipants, checkSettlement };
