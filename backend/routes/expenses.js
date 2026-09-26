const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { FieldValue } = require('firebase-admin/firestore');
const authMid = require('../middleware/authMiddleware');
const socketService = require('../services/socketService');
const { validateBody } = require('../middleware/validate');
const { createExpenseSchema, updateExpenseSchema, markWrongSchema, settleSchema } = require('../validation/expenseValidation');
const { checkGroupMembership, checkExpenseGroupMembership } = require('../middleware/membershipMiddleware');
const { checkExpenseSplits, checkExpenseParticipants, checkSettlement } = require('../services/expenseRules');
const { toPaise, fromPaise } = require('../utils/money');
const { simplifyDebts } = require('../services/debtSimplifier');
const { fetchUsernames, fetchGroupNames } = require('../utils/lookups');
const { SETTLEMENT_STATUS, isSettlement, countsTowardBalance, settlementReceiver } = require('../services/ledger');
const { AUDIT_ACTIONS, addAuditEntry, diffFields } = require('../services/auditLog');
const { settlementActionSchema } = require('../validation/expenseValidation');

/** Queues a notification on a WriteBatch/Transaction so it commits together with the change. */
const addNotification = (writer, userId, message) => {
    writer.set(db.collection('notifications').doc(), {
        user_id: userId,
        message,
        is_read: false,
        created_at: FieldValue.serverTimestamp()
    });
};

const formatRupees = (amount) => `₹${Number(amount).toFixed(2)}`;

router.use(authMid);

// Timestamp -> milliseconds, for sorting newest first
const createdAtMs = (data) => (data.created_at ? data.created_at.toMillis() : 0);

router.get('/summary', async (req, res, next) => {
    try {
        const userId = req.user.userId;

        // Fetch all expenses where the user is involved (either paid or owes)
        const snapshot = await db.collection('expenses')
            .where('splits_userIds', 'array-contains', userId)
            .where('is_wrong', '==', false)
            .get();
        const expenses = snapshot.docs.map(doc => doc.data()).filter(countsTowardBalance);

        // Resolve every name in two batched reads instead of one read per row
        const [groupNames, usernames] = await Promise.all([
            fetchGroupNames(expenses.map(e => e.group_id)),
            fetchUsernames(expenses.flatMap(e => [e.paid_by, ...(e.splits || []).map(s => s.userId)]))
        ]);

        // Keyed by user ID (not username, which isn't unique); balances accumulate in paise
        const people = {};
        const addEntry = (otherUserId, groupId, amount) => {
            if (!people[otherUserId]) people[otherUserId] = { balance: 0, details: [] };
            people[otherUserId].balance += toPaise(amount);
            people[otherUserId].details.push({ group: groupNames[groupId], groupId, amount });
        };

        for (const data of expenses) {
            for (const split of data.splits || []) {
                if (!(split.amount_owed > 0)) continue;
                if (data.paid_by === userId && split.userId !== userId) {
                    addEntry(split.userId, data.group_id, split.amount_owed);   // you paid, they owe you
                } else if (data.paid_by !== userId && split.userId === userId) {
                    addEntry(data.paid_by, data.group_id, -split.amount_owed);  // they paid, you owe them
                }
            }
        }

        const youAreOwed = [];
        const youOwe = [];

        Object.entries(people).forEach(([otherUserId, data]) => {
            const base = { userId: otherUserId, username: usernames[otherUserId] };
            if (data.balance > 0) {
                youAreOwed.push({
                    ...base,
                    amount: fromPaise(data.balance),
                    details: data.details.filter(d => d.amount > 0)
                });
            } else if (data.balance < 0) {
                youOwe.push({
                    ...base,
                    amount: fromPaise(-data.balance),
                    details: data.details.filter(d => d.amount < 0).map(d => ({ ...d, amount: Math.abs(d.amount) }))
                });
            }
        });

        res.json({ youAreOwed, youOwe });
    } catch (err) {
        next(err);
    }
});

router.get('/recent', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const snapshot = await db.collection('expenses')
            .where('splits_userIds', 'array-contains', userId)
            .where('is_wrong', '==', false)
            .get();

        // Pick the 5 newest first, then look up names only for those
        const latest = snapshot.docs
            .filter(doc => countsTowardBalance(doc.data()))
            .sort((a, b) => createdAtMs(b.data()) - createdAtMs(a.data()))
            .slice(0, 5);

        const [usernames, groupNames] = await Promise.all([
            fetchUsernames(latest.map(doc => doc.data().paid_by)),
            fetchGroupNames(latest.map(doc => doc.data().group_id))
        ]);

        const recentExpenses = latest.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                description: data.description,
                amount: data.amount,
                created_at: data.created_at ? data.created_at.toDate() : null,
                paid_by_name: usernames[data.paid_by],
                group_name: groupNames[data.group_id],
                group_id: data.group_id
            };
        });

        res.json({ recentExpenses });
    } catch (err) {
        next(err);
    }
});

router.post('/:groupId', checkGroupMembership, validateBody(createExpenseSchema), async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        const { amount, description, splits, paidBy } = req.body;
        const payerId = paidBy || req.user.userId;

        const groupDoc = req.groupDoc;
        const group = req.group;
        if (!group.admin_id && !group.is_personal) {
            return res.status(403).json({ error: 'Cannot add expense: This group has no admin. Please elect one first.' });
        }

        const participantError = checkExpenseParticipants({ members: group.members || [], payerId, splits });
        if (participantError) {
            return res.status(400).json({ error: participantError });
        }

        const parsedSplits = splits.filter(s => s.amount_owed > 0);
        const uniqueSplitUserIds = Array.from(new Set([payerId, ...parsedSplits.map(s => s.userId)]));

        // Expense, notifications and audit entry are committed together (all or nothing)
        const batch = db.batch();
        const newExpenseRef = db.collection('expenses').doc();
        batch.set(newExpenseRef, {
            type: 'expense',
            group_id: groupId,
            paid_by: payerId,
            amount,
            description: description,
            is_wrong: false,
            splits: parsedSplits,
            splits_userIds: uniqueSplitUserIds,
            hidden_by: [],
            created_by: req.user.userId,
            created_at: FieldValue.serverTimestamp()
        });
        for (const split of parsedSplits) {
            if (split.userId !== req.user.userId) {
                addNotification(batch, split.userId, `"${req.user.username}" added an expense "${description}". You owe ${formatRupees(split.amount_owed)}.`);
            }
        }
        addAuditEntry(batch, {
            groupId, expenseId: newExpenseRef.id, action: AUDIT_ACTIONS.CREATED, actorId: req.user.userId,
            changes: { amount: { from: null, to: amount }, description: { from: null, to: description } }
        });
        await batch.commit();

        const memberIds = group.members || [];
        socketService.emitToGroup(groupId, memberIds, 'update_expenses', { groupId, action: 'added' });
        socketService.emitToGroup(groupId, memberIds, 'update_summary', { groupId });

        for (let split of parsedSplits) {
            if (split.userId !== req.user.userId) {
                socketService.emitToUser(split.userId, 'update_notifications');
            }
        }

        res.status(201).json({ message: 'Expense added', expenseId: newExpenseRef.id });
    } catch (err) {
        next(err);
    }
});

router.get('/:groupId/all', checkGroupMembership, async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        
        // Pre-fetch all group members in a single batch to cache usernames
        const groupDoc = req.groupDoc;
        const memberIds = groupDoc.exists ? (groupDoc.data().members || []) : [];
        const userCache = {};
        if (memberIds.length > 0) {
            const refs = memberIds.map(mId => db.collection('users').doc(mId));
            const userDocs = await db.getAll(...refs);
            userDocs.forEach(uDoc => {
                userCache[uDoc.id] = uDoc.exists ? uDoc.data().username : 'Unknown';
            });
        }

        const getUsername = (uId) => {
            return userCache[uId] || 'Unknown';
        };

        const snapshot = await db.collection('expenses')
            .where('group_id', '==', groupId)
            .get();

        const expenses = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            // Skip deleted entries and ones this user hid
            if (data.deleted_at) continue;
            if (data.hidden_by && data.hidden_by.includes(req.user.userId)) continue;

            const paid_by_name = getUsername(data.paid_by);
            
            const enrichedSplits = [];
            for (const s of data.splits || []) {
                const username = getUsername(s.userId);
                enrichedSplits.push({
                    userId: s.userId,
                    username,
                    amount: s.amount_owed
                });
            }

            const settlement = isSettlement(data);
            expenses.push({
                id: doc.id,
                ...data,
                type: settlement ? 'settlement' : 'expense',
                settlement_status: settlement ? (data.settlement_status || SETTLEMENT_STATUS.CONFIRMED) : null,
                paid_by_name,
                splits: enrichedSplits,
                created_at: data.created_at ? data.created_at.toDate() : null
            });
        }

        // Sort in-memory descending by created_at
        expenses.sort((a, b) => {
            const timeA = a.created_at ? a.created_at.getTime() : 0;
            const timeB = b.created_at ? b.created_at.getTime() : 0;
            return timeB - timeA;
        });

        res.json({ expenses });
    } catch (err) {
        next(err);
    }
});

const deleteUserEntriesInGroup = async (req, res, next) => {
    try {
        const { groupId, userId } = req.params;

        const groupDoc = req.groupDoc;

        const isGroupOwner = groupDoc.data().created_by === req.user.userId;
        const isTargetUser = userId === req.user.userId;
        if (!isGroupOwner && !isTargetUser) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const snapshot = await db.collection('expenses')
            .where('group_id', '==', groupId)
            .where('paid_by', '==', userId)
            .get();

        const active = snapshot.docs.filter(doc => !doc.data().deleted_at);
        const batch = db.batch();
        active.forEach(doc => {
            batch.update(doc.ref, { deleted_at: FieldValue.serverTimestamp(), deleted_by: req.user.userId });
            addAuditEntry(batch, { groupId, expenseId: doc.id, action: AUDIT_ACTIONS.DELETED, actorId: req.user.userId });
        });
        await batch.commit();

        res.json({ message: `Deleted ${active.length} expense entries` });
    } catch (err) {
        next(err);
    }
};

router.delete('/:groupId/user/:userId/all', checkGroupMembership, deleteUserEntriesInGroup);
router.delete('/:groupId/user/:userId', checkGroupMembership, deleteUserEntriesInGroup);

router.delete('/:expenseId', checkExpenseGroupMembership, async (req, res, next) => {
    try {
        const expenseId = req.params.expenseId;
        const expDoc = req.expenseDoc;
        const expense = req.expense;
        if (expense.paid_by !== req.user.userId) {
            return res.status(403).json({ error: 'Permission denied: Only the expense creator can delete this.' });
        }

        const groupId = expense.group_id;
        const groupDoc = req.groupDoc;
        const members = groupDoc.exists ? groupDoc.data().members || [] : [];

        // Soft delete: the entry stays in the database (for the audit trail) but no longer counts anywhere
        const batch = db.batch();
        batch.update(expDoc.ref, { deleted_at: FieldValue.serverTimestamp(), deleted_by: req.user.userId });
        const msg = isSettlement(expense)
            ? `Notice: The settlement "${expense.description}" was cancelled.`
            : `Notice: The expense "${expense.description}" has been deleted. Associated debts have been reversed.`;
        for (const mId of members) addNotification(batch, mId, msg);
        addAuditEntry(batch, { groupId, expenseId, action: AUDIT_ACTIONS.DELETED, actorId: req.user.userId });
        await batch.commit();

        for (let mId of members) {
            socketService.emitToUser(mId, 'update_notifications');
        }

        socketService.emitToGroup(groupId, members, 'update_expenses', { groupId, action: 'deleted' });
        socketService.emitToGroup(groupId, members, 'update_summary', { groupId });

        res.json({ message: 'Expense deleted' });
    } catch (err) {
        next(err);
    }
});

router.put('/:expenseId', checkExpenseGroupMembership, validateBody(updateExpenseSchema), async (req, res, next) => {
    try {
        const expenseId = req.params.expenseId;
        const { amount, description, splits } = req.body;
        const userId = req.user.userId;

        const expDoc = req.expenseDoc;
        const expense = req.expense;

        const groupDoc = req.groupDoc;
        const admin_id = groupDoc.exists ? groupDoc.data().admin_id : null;

        if (expense.paid_by !== userId && admin_id !== userId) {
            return res.status(403).json({ error: 'Permission denied' });
        }
        if (expense.is_wrong) {
            return res.status(403).json({ error: 'Cannot edit: This entry is marked as WRONG by the admin. Please delete it or wait for admin review.' });
        }

        const members = groupDoc.exists ? groupDoc.data().members || [] : [];

        // Only fields that were sent are changed. If the money changes, the result must still add up
        // (checked only then, so older entries with rounding gaps can still be renamed).
        const moneyChanged = amount !== undefined || splits !== undefined;
        const splitError = (moneyChanged && checkExpenseSplits({ amount: amount ?? expense.amount, splits: splits ?? expense.splits ?? [] }))
            || (splits && checkExpenseParticipants({ members, payerId: expense.paid_by, splits }));
        if (splitError) {
            return res.status(400).json({ error: splitError });
        }

        const updates = {};
        if (amount !== undefined) updates.amount = amount;
        if (description !== undefined) updates.description = description;
        if (splits !== undefined) {
            updates.splits = splits.filter(s => s.amount_owed > 0);
            updates.splits_userIds = Array.from(new Set([expense.paid_by, ...updates.splits.map(s => s.userId)]));
        }

        const changes = diffFields(expense, updates, ['amount', 'description', 'splits']);
        const batch = db.batch();
        batch.update(expDoc.ref, updates);
        if (Object.keys(changes).length > 0) {
            addAuditEntry(batch, { groupId: expense.group_id, expenseId, action: AUDIT_ACTIONS.UPDATED, actorId: userId, changes });
        }
        await batch.commit();

        socketService.emitToGroup(expense.group_id, members, 'update_expenses', { groupId: expense.group_id, action: 'updated' });
        socketService.emitToGroup(expense.group_id, members, 'update_summary', { groupId: expense.group_id });

        res.json({ message: 'Expense updated' });
    } catch (err) {
        next(err);
    }
});

router.post('/:expenseId/mark-wrong', checkExpenseGroupMembership, validateBody(markWrongSchema), async (req, res, next) => {
    try {
        const expenseId = req.params.expenseId;
        const { isWrong } = req.body;
        const userId = req.user.userId;

        const expDoc = req.expenseDoc;
        const expense = req.expense;

        const groupDoc = req.groupDoc;
        if (!groupDoc.exists || groupDoc.data().admin_id !== userId) {
            return res.status(403).json({ error: 'Only the group admin can mark entries as wrong.' });
        }

        const members = groupDoc.data().members || [];
        const statusMsg = isWrong ? 'WRONG' : 'CORRECT';
        const msg = `Notice: Admin marked the expense "${expense.description}" as ${statusMsg}. Associated debts have been ${isWrong ? 'resolved' : 're-instated'}.`;
        const creatorMsg = isWrong ? `Admin flagged your entry "${expense.description}" as WRONG.` : `Admin marked your entry "${expense.description}" as CORRECT.`;

        const batch = db.batch();
        batch.update(expDoc.ref, { is_wrong: !!isWrong });
        for (const mId of members) {
            addNotification(batch, mId, mId === expense.paid_by ? creatorMsg : msg);
        }
        addAuditEntry(batch, {
            groupId: expense.group_id, expenseId,
            action: isWrong ? AUDIT_ACTIONS.MARKED_WRONG : AUDIT_ACTIONS.MARKED_CORRECT, actorId: userId
        });
        await batch.commit();

        for (let mId of members) {
            socketService.emitToUser(mId, 'update_notifications');
        }

        socketService.emitToGroup(expense.group_id, members, 'update_expenses', { groupId: expense.group_id, action: 'mark_wrong' });
        socketService.emitToGroup(expense.group_id, members, 'update_summary', { groupId: expense.group_id });

        res.json({ message: isWrong ? 'Entry marked as wrong' : 'Entry marked as correct' });
    } catch (err) {
        next(err);
    }
});

router.post('/:expenseId/hide', checkExpenseGroupMembership, async (req, res) => {
    try {
        const expenseId = req.params.expenseId;
        const userId = req.user.userId;

        await db.collection('expenses').doc(expenseId).update({
            hidden_by: FieldValue.arrayUnion(userId)
        });

        res.json({ message: 'Entry hidden for you' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/:groupId/settlements', checkGroupMembership, async (req, res, next) => {
    try {
        const groupId = req.params.groupId;

        // Fetch the group and pre-fetch all member profiles in a single batch to cache usernames
        const groupDoc = req.groupDoc;
        const memberIds = groupDoc.exists ? (groupDoc.data().members || []) : [];
        const userCache = {};
        if (memberIds.length > 0) {
            const refs = memberIds.map(mId => db.collection('users').doc(mId));
            const userDocs = await db.getAll(...refs);
            userDocs.forEach(uDoc => {
                userCache[uDoc.id] = uDoc.exists ? uDoc.data().username : 'Unknown';
            });
        }

        const getUsername = (uId) => {
            return userCache[uId] || 'Unknown';
        };

        const snapshot = await db.collection('expenses')
            .where('group_id', '==', groupId)
            .where('is_wrong', '==', false)
            .get();

        const balancePaise = {};
        const details = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (!countsTowardBalance(data)) continue; // deleted, or a settlement not yet confirmed
            const paid_by_name = getUsername(data.paid_by);

            for (const split of data.splits || []) {
                const owed_by_name = getUsername(split.userId);

                const owedPaise = toPaise(split.amount_owed);
                balancePaise[data.paid_by] = (balancePaise[data.paid_by] || 0) + owedPaise;
                balancePaise[split.userId] = (balancePaise[split.userId] || 0) - owedPaise;

                details.push({
                    expense_id: doc.id,
                    description: data.description,
                    date: data.created_at ? data.created_at.toDate() : null,
                    payer_id: data.paid_by,
                    payer_name: paid_by_name,
                    debtor_id: split.userId,
                    debtor_name: owed_by_name,
                    amount: split.amount_owed
                });
            }
        }

        const balances = Object.fromEntries(
            Object.entries(balancePaise).map(([uId, paise]) => [uId, fromPaise(paise)])
        );
        const simplifiedDebts = simplifyDebts(balances, userCache);

        res.json({ balances, details, simplifiedDebts });
    } catch (err) {
        next(err);
    }
});

router.post('/:groupId/settle', checkGroupMembership, validateBody(settleSchema), async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        const { toUserId, fromUserId, amount } = req.body;
        const actingUserId = req.user.userId;
        const actualFromId = fromUserId || actingUserId;
        const members = req.group.members || [];

        const settlementError = checkSettlement({ members, actingUserId, fromUserId: actualFromId, toUserId });
        if (settlementError) {
            return res.status(400).json({ error: settlementError });
        }

        const usernames = await fetchUsernames([actualFromId, toUserId]);
        const description = `Settlement Payment to ${usernames[toUserId]}`;

        // The receiver saying "I got paid" can be trusted immediately; the payer saying "I paid"
        // stays pending until the receiver confirms, so nobody can wipe out a debt on their own.
        const recordedByReceiver = actingUserId === toUserId;
        const status = recordedByReceiver ? SETTLEMENT_STATUS.CONFIRMED : SETTLEMENT_STATUS.PENDING;

        const batch = db.batch();
        const settlementRef = db.collection('expenses').doc();
        batch.set(settlementRef, {
            type: 'settlement',
            settlement_status: status,
            group_id: groupId,
            paid_by: actualFromId,
            to_user_id: toUserId,
            amount,
            description,
            is_wrong: false,
            splits: [{ userId: toUserId, amount_owed: amount }],
            splits_userIds: [actualFromId, toUserId],
            hidden_by: [],
            created_by: actingUserId,
            created_at: FieldValue.serverTimestamp(),
            ...(recordedByReceiver && { confirmed_at: FieldValue.serverTimestamp() })
        });
        addAuditEntry(batch, {
            groupId, expenseId: settlementRef.id, action: AUDIT_ACTIONS.SETTLEMENT_RECORDED, actorId: actingUserId,
            changes: { amount: { from: null, to: amount }, settlement_status: { from: null, to: status } }
        });

        const otherPartyId = recordedByReceiver ? actualFromId : toUserId;
        addNotification(batch, otherPartyId, recordedByReceiver
            ? `${usernames[toUserId]} recorded that you paid them ${formatRupees(amount)} in "${req.group.name}".`
            : `${usernames[actualFromId]} says they paid you ${formatRupees(amount)} in "${req.group.name}". Open the group to confirm you received it.`);
        await batch.commit();

        socketService.emitToGroup(groupId, members, 'update_expenses', { groupId, action: 'settled' });
        socketService.emitToGroup(groupId, members, 'update_summary', { groupId });
        socketService.emitToUser(otherPartyId, 'update_notifications');

        res.status(201).json({
            message: recordedByReceiver
                ? 'Settlement recorded'
                : `Payment recorded. ${usernames[toUserId]} needs to confirm they received it before balances update.`,
            settlementId: settlementRef.id,
            status
        });
    } catch (err) {
        next(err);
    }
});

// Receiver confirms or rejects a pending settlement
router.post('/:expenseId/settlement', checkExpenseGroupMembership, validateBody(settlementActionSchema), async (req, res, next) => {
    try {
        const { expenseId } = req.params;
        const { action } = req.body;
        const userId = req.user.userId;
        const expenseRef = req.expenseDoc.ref;
        const members = req.group.members || [];

        // Transaction: re-read inside so two clicks (or two devices) can't both change the status
        const result = await db.runTransaction(async (tx) => {
            const snap = await tx.get(expenseRef);
            const entry = snap.data();

            if (!isSettlement(entry)) return { status: 400, error: 'This entry is not a settlement' };
            if (settlementReceiver(entry) !== userId) return { status: 403, error: 'Only the person who received the payment can confirm or reject it' };
            const current = entry.settlement_status || SETTLEMENT_STATUS.CONFIRMED;
            if (current !== SETTLEMENT_STATUS.PENDING) {
                return { status: 400, error: `This settlement is already ${current}` };
            }

            const newStatus = action === 'confirm' ? SETTLEMENT_STATUS.CONFIRMED : SETTLEMENT_STATUS.REJECTED;
            tx.update(expenseRef, {
                settlement_status: newStatus,
                [`${newStatus}_at`]: FieldValue.serverTimestamp()
            });
            addAuditEntry(tx, {
                groupId: entry.group_id, expenseId,
                action: action === 'confirm' ? AUDIT_ACTIONS.SETTLEMENT_CONFIRMED : AUDIT_ACTIONS.SETTLEMENT_REJECTED,
                actorId: userId,
                changes: { settlement_status: { from: SETTLEMENT_STATUS.PENDING, to: newStatus } }
            });
            addNotification(tx, entry.paid_by, action === 'confirm'
                ? `${req.user.username} confirmed receiving your payment of ${formatRupees(entry.amount)} in "${req.group.name}".`
                : `${req.user.username} says they did NOT receive your payment of ${formatRupees(entry.amount)} in "${req.group.name}". The balance is unchanged.`);
            return { status: 200, newStatus, payerId: entry.paid_by, groupId: entry.group_id };
        });

        if (result.error) return res.status(result.status).json({ error: result.error });

        socketService.emitToGroup(result.groupId, members, 'update_expenses', { groupId: result.groupId, action: `settlement_${result.newStatus}` });
        socketService.emitToGroup(result.groupId, members, 'update_summary', { groupId: result.groupId });
        socketService.emitToUser(result.payerId, 'update_notifications');

        res.json({ message: action === 'confirm' ? 'Payment confirmed' : 'Payment rejected', status: result.newStatus });
    } catch (err) {
        next(err);
    }
});

// Change history of one entry, oldest first
router.get('/:expenseId/history', checkExpenseGroupMembership, async (req, res, next) => {
    try {
        const snapshot = await db.collection('audit_logs').where('expense_id', '==', req.params.expenseId).get();
        const entries = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => (a.created_at?.toMillis() || 0) - (b.created_at?.toMillis() || 0));
        const names = await fetchUsernames(entries.map(e => e.actor_id));

        res.json({
            history: entries.map(e => ({
                id: e.id,
                action: e.action,
                actor_id: e.actor_id,
                actor_name: names[e.actor_id],
                changes: e.changes,
                created_at: e.created_at ? e.created_at.toDate() : null
            }))
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
