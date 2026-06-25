const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { FieldValue } = require('firebase-admin/firestore');
const authMid = require('../middleware/authMiddleware');
const socketService = require('../services/socketService');
const { validateBody } = require('../middleware/validate');
const { createExpenseSchema, updateExpenseSchema, markWrongSchema, settleSchema } = require('../validation/expenseValidation');

router.use(authMid);

router.get('/summary', async (req, res, next) => {
    try {
        const userId = req.user.userId;

        // Fetch all expenses where the user is involved (either paid or owes)
        const snapshot = await db.collection('expenses')
            .where('splits_userIds', 'array-contains', userId)
            .where('is_wrong', '==', false)
            .get();

        const summaryItems = {};

        // To map IDs to names
        const groupCache = {};
        const userCache = {};

        const getGroupName = async (groupId) => {
            if (groupCache[groupId]) return groupCache[groupId];
            const gDoc = await db.collection('groups').doc(groupId).get();
            const name = gDoc.exists ? gDoc.data().name : 'Unknown Group';
            groupCache[groupId] = name;
            return name;
        };

        const getUsername = async (uId) => {
            if (userCache[uId]) return userCache[uId];
            const uDoc = await db.collection('users').doc(uId).get();
            const name = uDoc.exists ? uDoc.data().username : 'Unknown User';
            userCache[uId] = name;
            return name;
        };

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const groupId = data.group_id;
            const groupName = await getGroupName(groupId);
            
            if (data.paid_by === userId) {
                // You paid, others owe you
                for (const split of data.splits) {
                    if (split.userId !== userId && split.amount_owed > 0) {
                        const username = await getUsername(split.userId);
                        if (!summaryItems[username]) summaryItems[username] = { userId: split.userId, balance: 0, details: [] };
                        summaryItems[username].balance += split.amount_owed;
                        summaryItems[username].details.push({ group: groupName, groupId: groupId, amount: split.amount_owed });
                    }
                }
            } else {
                // Someone else paid, check if you owe them
                for (const split of data.splits) {
                    if (split.userId === userId && split.amount_owed > 0) {
                        const username = await getUsername(data.paid_by);
                        if (!summaryItems[username]) summaryItems[username] = { userId: data.paid_by, balance: 0, details: [] };
                        summaryItems[username].balance -= split.amount_owed;
                        summaryItems[username].details.push({ group: groupName, groupId: groupId, amount: -split.amount_owed });
                    }
                }
            }
        }

        const youAreOwed = [];
        const youOwe = [];

        Object.entries(summaryItems).forEach(([username, data]) => {
            if (data.balance > 0.01) {
                youAreOwed.push({
                    username,
                    amount: data.balance,
                    details: data.details.filter(d => d.amount > 0)
                });
            } else if (data.balance < -0.01) {
                youOwe.push({
                    username,
                    amount: Math.abs(data.balance),
                    details: data.details.filter(d => d.amount < 0).map(d => ({ ...d, amount: Math.abs(d.amount) }))
                });
            }
        });

        res.json({ youAreOwed, youOwe });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/recent', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const snapshot = await db.collection('expenses')
            .where('splits_userIds', 'array-contains', userId)
            .where('is_wrong', '==', false)
            .get();

        let recentExpenses = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            
            let paid_by_name = 'Unknown';
            const uDoc = await db.collection('users').doc(data.paid_by).get();
            if (uDoc.exists) paid_by_name = uDoc.data().username;

            let group_name = 'Unknown';
            const gDoc = await db.collection('groups').doc(data.group_id).get();
            if (gDoc.exists) group_name = gDoc.data().name;

            recentExpenses.push({
                id: doc.id,
                description: data.description,
                amount: data.amount,
                created_at: data.created_at ? data.created_at.toDate() : null,
                paid_by_name,
                group_name,
                group_id: data.group_id
            });
        }

        // Sort in-memory descending by created_at
        recentExpenses.sort((a, b) => {
            const timeA = a.created_at ? a.created_at.getTime() : 0;
            const timeB = b.created_at ? b.created_at.getTime() : 0;
            return timeB - timeA;
        });

        // Limit to top 5
        recentExpenses = recentExpenses.slice(0, 5);

        res.json({ recentExpenses });
    } catch (err) {
        next(err);
    }
});

router.post('/:groupId', validateBody(createExpenseSchema), async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        const { amount, description, splits, paidBy } = req.body;
        const payerId = paidBy || req.user.userId;

        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });
        
        const group = groupDoc.data();
        if (!group.admin_id && !group.is_personal) {
            return res.status(403).json({ error: 'Cannot add expense: This group has no admin. Please elect one first.' });
        }

        const splits_userIds = [payerId, ...splits.filter(s => parseFloat(s.amount_owed) > 0).map(s => s.userId)];
        // make unique
        const uniqueSplitUserIds = Array.from(new Set(splits_userIds));

        const parsedSplits = splits.map(s => ({
            userId: s.userId,
            amount_owed: parseFloat(s.amount_owed)
        })).filter(s => s.amount_owed > 0);

        const newExpenseRef = await db.collection('expenses').add({
            group_id: groupId,
            paid_by: payerId,
            amount: parseFloat(amount),
            description: description,
            is_wrong: false,
            splits: parsedSplits,
            splits_userIds: uniqueSplitUserIds,
            hidden_by: [],
            created_at: FieldValue.serverTimestamp()
        });

        // Notifications
        const batch = db.batch();
        for (let split of parsedSplits) {
            if (split.userId !== req.user.userId) {
                const msg = `"${req.user.username}" added an expense "${description}". You owe $${split.amount_owed.toFixed(2)}.`;
                const notifRef = db.collection('notifications').doc();
                batch.set(notifRef, {
                    user_id: split.userId,
                    message: msg,
                    is_read: false,
                    created_at: FieldValue.serverTimestamp()
                });
            }
        }
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

router.get('/:groupId/all', async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        
        // Pre-fetch all group members in a single batch to cache usernames
        const groupDoc = await db.collection('groups').doc(groupId).get();
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
            
            // Skip hidden
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

            expenses.push({
                id: doc.id,
                ...data,
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

const deleteUserEntriesInGroup = async (req, res) => {
    try {
        const { groupId, userId } = req.params;

        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });

        const isGroupOwner = groupDoc.data().created_by === req.user.userId;
        const isTargetUser = userId === req.user.userId;
        if (!isGroupOwner && !isTargetUser) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const snapshot = await db.collection('expenses')
            .where('group_id', '==', groupId)
            .where('paid_by', '==', userId)
            .get();

        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        res.json({ message: `Deleted ${snapshot.size} expense entries` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
};

router.delete('/:groupId/user/:userId/all', deleteUserEntriesInGroup);
router.delete('/:groupId/user/:userId', deleteUserEntriesInGroup);

router.delete('/:expenseId', async (req, res) => {
    try {
        const expenseId = req.params.expenseId;
        const expDoc = await db.collection('expenses').doc(expenseId).get();
        
        if (!expDoc.exists) return res.status(404).json({ error: 'Expense not found' });
        
        const expense = expDoc.data();
        if (expense.paid_by !== req.user.userId) {
            return res.status(403).json({ error: 'Permission denied: Only the expense creator can delete this.' });
        }

        const groupId = expense.group_id;
        const groupDoc = await db.collection('groups').doc(groupId).get();
        const members = groupDoc.exists ? groupDoc.data().members || [] : [];

        await expDoc.ref.delete();

        const msg = `Notice: The expense "${expense.description}" has been deleted. Associated debts have been reversed.`;
        const batch = db.batch();
        for (let mId of members) {
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                user_id: mId,
                message: msg,
                is_read: false,
                created_at: FieldValue.serverTimestamp()
            });
        }
        await batch.commit();

        for (let mId of members) {
            socketService.emitToUser(mId, 'update_notifications');
        }

        socketService.emitToGroup(groupId, members, 'update_expenses', { groupId, action: 'deleted' });
        socketService.emitToGroup(groupId, members, 'update_summary', { groupId });

        res.json({ message: 'Expense deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/:expenseId', validateBody(updateExpenseSchema), async (req, res, next) => {
    try {
        const expenseId = req.params.expenseId;
        const { amount, description, splits } = req.body;
        const userId = req.user.userId;

        const expDoc = await db.collection('expenses').doc(expenseId).get();
        if (!expDoc.exists) return res.status(404).json({ error: 'Expense not found' });
        const expense = expDoc.data();

        const groupDoc = await db.collection('groups').doc(expense.group_id).get();
        const admin_id = groupDoc.exists ? groupDoc.data().admin_id : null;

        if (expense.paid_by !== userId && admin_id !== userId) {
            return res.status(403).json({ error: 'Permission denied' });
        }
        if (expense.is_wrong) {
            return res.status(403).json({ error: 'Cannot edit: This entry is marked as WRONG by the admin. Please delete it or wait for admin review.' });
        }

        const parsedSplits = (splits || []).map(s => ({
            userId: s.userId,
            amount_owed: parseFloat(s.amount_owed)
        })).filter(s => s.amount_owed > 0);

        const splits_userIds = [expense.paid_by, ...parsedSplits.map(s => s.userId)];
        const uniqueSplitUserIds = Array.from(new Set(splits_userIds));

        await expDoc.ref.update({
            amount: parseFloat(amount),
            description: description,
            splits: parsedSplits,
            splits_userIds: uniqueSplitUserIds
        });

        const members = groupDoc.exists ? groupDoc.data().members || [] : [];

        socketService.emitToGroup(expense.group_id, members, 'update_expenses', { groupId: expense.group_id, action: 'updated' });
        socketService.emitToGroup(expense.group_id, members, 'update_summary', { groupId: expense.group_id });

        res.json({ message: 'Expense updated' });
    } catch (err) {
        next(err);
    }
});

router.post('/:expenseId/mark-wrong', validateBody(markWrongSchema), async (req, res, next) => {
    try {
        const expenseId = req.params.expenseId;
        const { isWrong } = req.body;
        const userId = req.user.userId;

        const expDoc = await db.collection('expenses').doc(expenseId).get();
        if (!expDoc.exists) return res.status(404).json({ error: 'Expense not found' });
        const expense = expDoc.data();

        const groupDoc = await db.collection('groups').doc(expense.group_id).get();
        if (!groupDoc.exists || groupDoc.data().admin_id !== userId) {
            return res.status(403).json({ error: 'Only the group admin can mark entries as wrong.' });
        }

        await expDoc.ref.update({ is_wrong: !!isWrong });

        const members = groupDoc.data().members || [];
        const statusMsg = isWrong ? 'WRONG' : 'CORRECT';
        const msg = `Notice: Admin marked the expense "${expense.description}" as ${statusMsg}. Associated debts have been ${isWrong ? 'resolved' : 're-instated'}.`;
        const creatorMsg = isWrong ? `Admin flagged your entry "${expense.description}" as WRONG.` : `Admin marked your entry "${expense.description}" as CORRECT.`;

        const batch = db.batch();
        for (let mId of members) {
            const finalMsg = (mId === expense.paid_by) ? creatorMsg : msg;
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
                user_id: mId,
                message: finalMsg,
                is_read: false,
                created_at: FieldValue.serverTimestamp()
            });
        }
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

router.post('/:expenseId/hide', async (req, res) => {
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

router.get('/:groupId/settlements', async (req, res, next) => {
    try {
        const groupId = req.params.groupId;

        // Fetch the group and pre-fetch all member profiles in a single batch to cache usernames
        const groupDoc = await db.collection('groups').doc(groupId).get();
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

        const balances = {};
        const details = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const paid_by_name = getUsername(data.paid_by);

            for (const split of data.splits || []) {
                const owed_by_name = getUsername(split.userId);

                if (!balances[data.paid_by]) balances[data.paid_by] = 0;
                if (!balances[split.userId]) balances[split.userId] = 0;

                balances[data.paid_by] += split.amount_owed;
                balances[split.userId] -= split.amount_owed;

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

        const { simplifyDebts } = require('../services/debtSimplifier');
        const simplifiedDebts = simplifyDebts(balances, userCache);

        res.json({ balances, details, simplifiedDebts });
    } catch (err) {
        next(err);
    }
});

router.post('/:groupId/settle', validateBody(settleSchema), async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        const { toUserId, fromUserId, amount } = req.body;
        const actingUserId = req.user.userId;
        const actualFromId = fromUserId || actingUserId;

        const toUserDoc = await db.collection('users').doc(toUserId).get();
        const toUsername = toUserDoc.exists ? toUserDoc.data().username : 'User';
        const description = `Settlement Payment to ${toUsername}`;

        const newExpenseRef = await db.collection('expenses').add({
            group_id: groupId,
            paid_by: actualFromId,
            amount: parseFloat(amount),
            description: description,
            is_wrong: false,
            splits: [{ userId: toUserId, amount_owed: parseFloat(amount) }],
            splits_userIds: [actualFromId, toUserId],
            hidden_by: [],
            created_at: FieldValue.serverTimestamp()
        });

        const groupDoc = await db.collection('groups').doc(groupId).get();
        const members = groupDoc.exists ? groupDoc.data().members || [] : [];

        socketService.emitToGroup(groupId, members, 'update_expenses', { groupId, action: 'settled' });
        socketService.emitToGroup(groupId, members, 'update_summary', { groupId });
        socketService.emitToUser(toUserId, 'update_notifications');

        res.status(201).json({ message: 'Settlement recorded' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
