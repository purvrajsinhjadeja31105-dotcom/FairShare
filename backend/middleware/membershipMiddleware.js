const db = require('../config/db');

/**
 * Middleware to verify if the authenticated user is a member of the group.
 * Expects groupId to be in req.params.
 */
const checkGroupMembership = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const userId = req.user?.userId;

        if (!groupId) {
            return res.status(400).json({ error: 'Group ID is required' });
        }
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
        }

        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const groupData = groupDoc.data();
        const members = groupData.members || [];

        if (!members.includes(userId)) {
            return res.status(403).json({ error: 'Access denied: You are not a member of this group' });
        }

        // Attach group data to request object to avoid duplicate fetching
        req.group = groupData;
        req.groupDoc = groupDoc;
        next();
    } catch (err) {
        next(err);
    }
};

/**
 * Middleware to verify if the authenticated user is a member of the group
 * associated with a specific expense. Expects expenseId to be in req.params.
 */
const checkExpenseGroupMembership = async (req, res, next) => {
    try {
        const { expenseId } = req.params;
        const userId = req.user?.userId;

        if (!expenseId) {
            return res.status(400).json({ error: 'Expense ID is required' });
        }
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized: User not authenticated' });
        }

        const expenseDoc = await db.collection('expenses').doc(expenseId).get();
        if (!expenseDoc.exists) {
            return res.status(404).json({ error: 'Expense not found' });
        }

        const expenseData = expenseDoc.data();
        const groupId = expenseData.group_id;

        if (!groupId) {
            return res.status(400).json({ error: 'Group ID not associated with this expense' });
        }

        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) {
            return res.status(404).json({ error: 'Associated group not found' });
        }

        const groupData = groupDoc.data();
        const members = groupData.members || [];

        if (!members.includes(userId)) {
            return res.status(403).json({ error: 'Access denied: You are not a member of the group associated with this expense' });
        }

        // Attach data to request object to avoid duplicate fetching
        req.expense = expenseData;
        req.expenseDoc = expenseDoc;
        req.group = groupData;
        req.groupDoc = groupDoc;
        next();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    checkGroupMembership,
    checkExpenseGroupMembership
};
