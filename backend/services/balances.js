/**
 * Balance calculations shared by the Group screen and the Home overview,
 * so both always show the same numbers. Pure functions: no database access.
 */
const { toPaise, fromPaise } = require('../utils/money');
const { countsTowardBalance, isSettlement, settlementStatus, settlementReceiver, SETTLEMENT_STATUS } = require('./ledger');
const { simplifyDebts } = require('./debtSimplifier');

/**
 * Net balance per member of one group, in paise.
 * Positive = the group owes them; negative = they owe the group. Always sums to 0.
 */
const groupBalancesPaise = (entries) => {
    const balances = {};
    for (const entry of entries) {
        if (!countsTowardBalance(entry)) continue;
        for (const split of entry.splits || []) {
            const owed = toPaise(split.amount_owed);
            balances[entry.paid_by] = (balances[entry.paid_by] || 0) + owed;
            balances[split.userId] = (balances[split.userId] || 0) - owed;
        }
    }
    return balances;
};

/** Balances (rupees) plus the fewest payments that settle the group. */
const summarizeGroup = (entries, names = {}) => {
    const paise = groupBalancesPaise(entries);
    const balances = Object.fromEntries(Object.entries(paise).map(([id, p]) => [id, fromPaise(p)]));
    return { balances, simplifiedDebts: simplifyDebts(balances, names) };
};

/**
 * Everything the Home screen needs for one user across all their groups.
 * `groups` is [{ id, name, members, entries }].
 */
const buildOverview = (userId, groups, names = {}) => {
    let totalPaise = 0;
    const people = {};
    const groupRows = [];
    const pendingForYou = [];   // payments others say they sent you, waiting for your confirmation
    const pendingByYou = [];    // payments you sent, waiting for the other person

    for (const group of groups) {
        const { balances, simplifiedDebts } = summarizeGroup(group.entries, names);
        const myBalance = balances[userId] || 0;
        totalPaise += toPaise(myBalance);
        groupRows.push({ id: group.id, name: group.name, member_count: (group.members || []).length, my_balance: myBalance });

        // People balances come from each group's suggested payments, so "Settle up" on Home
        // pays exactly what the Group screen suggests.
        for (const debt of simplifiedDebts) {
            const iPay = debt.fromUserId === userId;
            const iReceive = debt.toUserId === userId;
            if (!iPay && !iReceive) continue;

            const otherId = iPay ? debt.toUserId : debt.fromUserId;
            const signedPaise = toPaise(debt.amount) * (iReceive ? 1 : -1);
            if (!people[otherId]) people[otherId] = { userId: otherId, username: names[otherId] || 'Unknown User', balancePaise: 0, groups: [] };
            people[otherId].balancePaise += signedPaise;
            people[otherId].groups.push({ groupId: group.id, groupName: group.name, amount: fromPaise(signedPaise) });
        }

        for (const entry of group.entries) {
            if (!isSettlement(entry) || entry.deleted_at || settlementStatus(entry) !== SETTLEMENT_STATUS.PENDING) continue;
            const row = {
                id: entry.id,
                groupId: group.id,
                groupName: group.name,
                amount: entry.amount,
                fromUserId: entry.paid_by,
                fromUserName: names[entry.paid_by] || 'Unknown User',
                toUserId: settlementReceiver(entry),
                toUserName: names[settlementReceiver(entry)] || 'Unknown User'
            };
            if (row.toUserId === userId) pendingForYou.push(row);
            else if (row.fromUserId === userId) pendingByYou.push(row);
        }
    }

    const peopleRows = Object.values(people)
        // kept even if debts in different groups net to 0: each group still has to be settled separately
        .filter(p => p.groups.length > 0)
        .map(({ balancePaise, ...p }) => ({ ...p, balance: fromPaise(balancePaise) }))
        .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));

    return {
        total: fromPaise(totalPaise),
        people: peopleRows,
        groups: groupRows,
        pendingForYou,
        pendingByYou
    };
};

module.exports = { groupBalancesPaise, summarizeGroup, buildOverview };
