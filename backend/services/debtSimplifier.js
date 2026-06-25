/**
 * Simplifies a web of debts using a greedy matching algorithm.
 * It matches the largest debtors with the largest creditors to settle
 * all balances in at most N - 1 transactions.
 * 
 * @param {Object} balances - Object containing net balances per user: { userId: amount }
 * @param {Object} memberNamesMap - Object mapping user ID to username: { userId: username }
 * @returns {Array} List of simplified transactions: [{ fromUserId, fromUserName, toUserId, toUserName, amount }]
 */
function simplifyDebts(balances, memberNamesMap) {
    const debtors = [];
    const creditors = [];

    // Separate members into debtors (owing money) and creditors (due money)
    for (const [userId, amount] of Object.entries(balances)) {
        const roundedAmount = Math.round(amount * 100) / 100;
        if (roundedAmount < -0.01) {
            debtors.push({ userId, balance: Math.abs(roundedAmount) });
        } else if (roundedAmount > 0.01) {
            creditors.push({ userId, balance: roundedAmount });
        }
    }

    // Sort descending by balance to resolve the largest debts first
    debtors.sort((a, b) => b.balance - a.balance);
    creditors.sort((a, b) => b.balance - a.balance);

    const simplifiedTransactions = [];

    let i = 0; // index for debtors
    let j = 0; // index for creditors

    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];

        // Settle the smaller of the two balances
        const settleAmount = Math.min(debtor.balance, creditor.balance);

        simplifiedTransactions.push({
            fromUserId: debtor.userId,
            fromUserName: memberNamesMap[debtor.userId] || 'Unknown User',
            toUserId: creditor.userId,
            toUserName: memberNamesMap[creditor.userId] || 'Unknown User',
            amount: Math.round(settleAmount * 100) / 100
        });

        // Subtract the settled amount from both balances
        debtor.balance -= settleAmount;
        creditor.balance -= settleAmount;

        // If a member's balance is resolved, advance the corresponding index
        if (debtor.balance < 0.01) {
            i++;
        }
        if (creditor.balance < 0.01) {
            j++;
        }
    }

    return simplifiedTransactions;
}

module.exports = { simplifyDebts };
