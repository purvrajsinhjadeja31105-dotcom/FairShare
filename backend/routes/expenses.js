const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { FieldValue } = require('firebase-admin/firestore');
const authMid = require('../middleware/authMiddleware');
const socketService = require('../services/socketService');
const { validateBody } = require('../middleware/validate');
const { createExpenseSchema, updateExpenseSchema, settleSchema, settlementActionSchema } = require('../validation/expenseValidation');
const { checkGroupMembership, checkExpenseGroupMembership } = require('../middleware/membershipMiddleware');
const { checkExpenseSplits, checkExpenseParticipants, checkSettlement } = require('../services/expenseRules');
const { todayIso } = require('../utils/dates');
const { toPaise } = require('../utils/money');
const { summarizeGroup, buildOverview } = require('../services/balances');
const { fetchUsernames } = require('../utils/lookups');
const { SETTLEMENT_STATUS, isSettlement, settlementReceiver } = require('../services/ledger');
const { AUDIT_ACTIONS, addAuditEntry, diffFields } = require('../services/auditLog');

/** Queues a notification on a WriteBatch/Transaction so it commits together with the change. */
const addNotification = (writer, userId, message) => {
    writer.set(db.collection('notifications').doc(), {
        user_id: userId,
        message,
        is_read: false,
        created_at: FieldValue.serverTimestamp()
    });
};

/** Edit/delete rule: the payer, or the person who added the entry. No admins. */
const canModify = (entry, userId) => entry.paid_by === userId || entry.created_by === userId;

const formatRupees = (amount) => `₹${Number(amount).toFixed(2)}`;

router.use(authMid);

// Everything the Home screen shows, in one request: total, people, groups, pending confirmations.
// People balances come from each group's suggested payments, so Home and Group always agree.
router.get('/overview', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const groupsSnap = await db.collection('groups').where('members', 'array-contains', userId).get();
        const groupDocs = groupsSnap.docs.filter(doc => !doc.data().is_personal);

        const entrySnaps = await Promise.all(groupDocs.map(g => db.collection('expenses').where('group_id', '==', g.id).get()));
        const groups = groupDocs.map((g, i) => ({
            id: g.id,
            name: g.data().name,
            members: g.data().members || [],
            entries: entrySnaps[i].docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }));

        const names = await fetchUsernames(groups.flatMap(g => [
            ...g.members,
            ...g.entries.flatMap(e => [e.paid_by, ...(e.splits || []).map(sp => sp.userId)])
        ]));

        res.json(buildOverview(userId, groups, names));
    } catch (err) {
        next(err);
    }
});

router.post('/:groupId', checkGroupMembership, validateBody(createExpenseSchema), async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        const { amount, description, splits, paidBy, date } = req.body;
        const payerId = paidBy || req.user.userId;
        const group = req.group;

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
            expense_date: date || todayIso(),
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
            
            if (data.deleted_at) continue;

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
                // entries from before dates were recorded use the day they were added
                expense_date: data.expense_date || (data.created_at ? data.created_at.toDate().toISOString().slice(0, 10) : null),
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

router.delete('/:expenseId', checkExpenseGroupMembership, async (req, res, next) => {
    try {
        const expenseId = req.params.expenseId;
        const expDoc = req.expenseDoc;
        const expense = req.expense;
        if (!canModify(expense, req.user.userId)) {
            return res.status(403).json({ error: 'Only the person who paid or who added this entry can delete it.' });
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
        const { amount, description, splits, date, paidBy } = req.body;
        const userId = req.user.userId;

        const expDoc = req.expenseDoc;
        const expense = req.expense;
        const groupDoc = req.groupDoc;

        if (!canModify(expense, userId)) {
            return res.status(403).json({ error: 'Only the person who paid or who added this expense can edit it.' });
        }
        if (isSettlement(expense)) {
            return res.status(400).json({ error: 'Payments cannot be edited. Delete it and record a new one instead.' });
        }

        const members = groupDoc.exists ? groupDoc.data().members || [] : [];

        // Only fields that were sent are changed. If the money changes, the result must still add up
        // (checked only then, so older entries with rounding gaps can still be renamed).
        const moneyChanged = amount !== undefined || splits !== undefined;
        const payerId = paidBy ?? expense.paid_by;
        const splitError = (moneyChanged && checkExpenseSplits({ amount: amount ?? expense.amount, splits: splits ?? expense.splits ?? [] }))
            || ((splits || paidBy) && checkExpenseParticipants({ members, payerId, splits: splits ?? expense.splits ?? [] }));
        if (splitError) {
            return res.status(400).json({ error: splitError });
        }

        const updates = {};
        if (amount !== undefined) updates.amount = amount;
        if (description !== undefined) updates.description = description;
        if (date !== undefined) updates.expense_date = date;
        if (paidBy !== undefined) updates.paid_by = paidBy;
        if (splits !== undefined || paidBy !== undefined) {
            updates.splits = (splits ?? expense.splits ?? []).filter(s => s.amount_owed > 0);
            updates.splits_userIds = Array.from(new Set([payerId, ...updates.splits.map(s => s.userId)]));
        }

        const changes = diffFields(expense, updates, ['amount', 'description', 'splits', 'expense_date', 'paid_by']);
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

router.get('/:groupId/settlements', checkGroupMembership, async (req, res, next) => {
    try {
        const snapshot = await db.collection('expenses').where('group_id', '==', req.params.groupId).get();
        const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // names for current members and anyone who appears in the ledger (e.g. someone who left)
        const names = await fetchUsernames([
            ...(req.group.members || []),
            ...entries.flatMap(e => [e.paid_by, ...(e.splits || []).map(sp => sp.userId)])
        ]);
        const { balances, simplifiedDebts } = summarizeGroup(entries, names);

        res.json({ balances, simplifiedDebts });
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

        // "I've paid" twice for the same payment (double tap, or tapping again while it's waiting)
        // must not record it twice: the receiver would have to reject the copy.
        const existing = await db.collection('expenses')
            .where('group_id', '==', groupId)
            .where('paid_by', '==', actualFromId)
            .get();
        const duplicate = existing.docs.map(d => d.data()).find(e =>
            isSettlement(e) && !e.deleted_at && e.settlement_status === SETTLEMENT_STATUS.PENDING &&
            settlementReceiver(e) === toUserId && toPaise(e.amount) === toPaise(amount));
        if (duplicate) {
            return res.status(409).json({ error: `This ${formatRupees(amount)} payment to ${usernames[toUserId]} is already waiting for ${usernames[toUserId]} to confirm.` });
        }

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
            expense_date: todayIso(),
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
