const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMid = require('../middleware/authMiddleware');
const socketService = require('../services/socketService');

router.use(authMid);

router.get('/summary', async (req, res) => {
    try {
        const userId = req.user.userId;

        // 1. You are owed: Detailed breakdown per person and group
        const [owedToYouRows] = await db.query(`
            SELECT u.id as user_id, u.username, eg.name as group_name, eg.id as group_id, SUM(es.amount_owed) as total
            FROM expenses e
            JOIN expense_splits es ON e.id = es.expense_id
            JOIN users u ON es.user_id = u.id
            JOIN expense_groups eg ON e.group_id = eg.id
            WHERE e.paid_by = ? AND es.user_id != ? AND e.is_wrong = 0
            GROUP BY u.id, e.group_id
        `, [userId, userId]);

        // 2. You owe: Detailed breakdown per person and group
        const [youOweRows] = await db.query(`
            SELECT u.id as user_id, u.username, eg.name as group_name, eg.id as group_id, SUM(es.amount_owed) as total
            FROM expenses e
            JOIN expense_splits es ON e.id = es.expense_id
            JOIN users u ON e.paid_by = u.id
            JOIN expense_groups eg ON e.group_id = eg.id
            WHERE es.user_id = ? AND e.paid_by != ? AND e.is_wrong = 0
            GROUP BY e.paid_by, e.group_id
        `, [userId, userId]);

        const summaryItems = {};

        owedToYouRows.forEach(row => {
            if (!summaryItems[row.username]) summaryItems[row.username] = { userId: row.user_id, balance: 0, details: [] };
            summaryItems[row.username].balance += parseFloat(row.total);
            summaryItems[row.username].details.push({ group: row.group_name, groupId: row.group_id, amount: parseFloat(row.total) });
        });

        youOweRows.forEach(row => {
            if (!summaryItems[row.username]) summaryItems[row.username] = { userId: row.user_id, balance: 0, details: [] };
            summaryItems[row.username].balance -= parseFloat(row.total);
            summaryItems[row.username].details.push({ group: row.group_name, groupId: row.group_id, amount: -parseFloat(row.total) });
        });

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

router.get('/recent', async (req, res) => {
    try {
        const userId = req.user.userId;
        const [recentExpenses] = await db.query(`
            SELECT
                e.id, e.description, e.amount, e.created_at,
                u.username as paid_by_name,
                eg.name as group_name,
                eg.id as group_id
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            JOIN expense_groups eg ON e.group_id = eg.id
            JOIN group_members gm ON eg.id = gm.group_id
            WHERE gm.user_id = ? AND e.is_wrong = 0
            ORDER BY e.created_at DESC
            LIMIT 5
        `, [userId]);
        res.json({ recentExpenses });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});


router.post('/:groupId', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { amount, description, splits, paidBy } = req.body;
        const payerId = paidBy || req.user.userId;

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if group has an admin (unless it's a personal group)
            const [grpRows] = await connection.query('SELECT admin_id, is_personal FROM expense_groups WHERE id = ?', [groupId]);
            if (!grpRows.length) return res.status(404).json({ error: 'Group not found' });
            
            const group = grpRows[0];
            if (!group.admin_id && !group.is_personal) {
                return res.status(403).json({ error: 'Cannot add expense: This group has no admin. Please elect one first.' });
            }

            const [expResult] = await connection.query(
                'INSERT INTO expenses (group_id, paid_by, amount, description) VALUES (?, ?, ?, ?)',
                [groupId, payerId, amount, description]
            );
            const expenseId = expResult.insertId;

            for (let split of splits) {
                if (parseFloat(split.amount_owed) > 0) {
                    await connection.query(
                        'INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES (?, ?, ?)',
                        [expenseId, split.userId, split.amount_owed]
                    );

                    if (parseInt(split.userId) !== parseInt(req.user.userId)) {
                        const msg = `"${req.user.username}" added an expense "${description}". You owe $${parseFloat(split.amount_owed).toFixed(2)}.`;
                        await connection.query(
                            'INSERT INTO notifications (user_id, message) VALUES (?, ?)',
                            [split.userId, msg]
                        );
                    }
                }
            }

            await connection.commit();

            // Notify group members
            const [members] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
            const memberIds = members.map(m => m.user_id);
            socketService.emitToGroup(groupId, memberIds, 'update_expenses', { groupId, action: 'added' });
            socketService.emitToGroup(groupId, memberIds, 'update_summary', { groupId });

            // Notify users about new notifications
            for (let split of splits) {
                if (parseInt(split.userId) !== parseInt(req.user.userId)) {
                    socketService.emitToUser(split.userId, 'update_notifications');
                }
            }

            res.status(201).json({ message: 'Expense added', expenseId });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/:groupId/all', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const [expenses] = await db.query(`
            SELECT e.*, u.username as paid_by_name
            FROM expenses e
            JOIN users u ON e.paid_by = u.id
            LEFT JOIN user_hidden_activities uha ON e.id = uha.expense_id AND uha.user_id = ?
            WHERE e.group_id = ? AND uha.expense_id IS NULL
            ORDER BY e.created_at DESC
        `, [req.user.userId, groupId]);

        // For each expense, fetch who owes how much
        const [splits] = await db.query(`
            SELECT es.expense_id, es.user_id, es.amount_owed, u.username as owed_by_name
            FROM expense_splits es
            JOIN users u ON es.user_id = u.id
            WHERE es.expense_id IN (
                SELECT id FROM expenses WHERE group_id = ?
            )
        `, [groupId]);

        // Attach splits to each expense
        const splitsMap = {};
        for (const s of splits) {
            if (!splitsMap[s.expense_id]) splitsMap[s.expense_id] = [];
            splitsMap[s.expense_id].push({ userId: s.user_id, username: s.owed_by_name, amount: parseFloat(s.amount_owed) });
        }
        const enriched = expenses.map(e => ({ ...e, splits: splitsMap[e.id] || [] }));

        res.json({ expenses: enriched });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

const deleteUserEntriesInGroup = async (req, res) => {
    try {
        const { groupId, userId } = req.params;
        const targetUserId = parseInt(userId, 10);

        const [groupRows] = await db.query('SELECT created_by FROM expense_groups WHERE id = ?', [groupId]);
        if (!groupRows.length) return res.status(404).json({ error: 'Group not found' });

        const isGroupOwner = groupRows[0].created_by === req.user.userId;
        const isTargetUser = targetUserId === req.user.userId;
        if (!isGroupOwner && !isTargetUser) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const [deleteResult] = await db.query('DELETE FROM expenses WHERE group_id = ? AND paid_by = ?', [groupId, targetUserId]);
        res.json({ message: `Deleted ${deleteResult.affectedRows} expense entries` });
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
        const [rows] = await db.query(
            `SELECT e.id, e.paid_by, eg.admin_id
            FROM expenses e
            JOIN expense_groups eg ON e.group_id = eg.id
            WHERE e.id = ?`,
            [expenseId]
        );

        if (!rows.length) return res.status(404).json({ error: 'Expense not found' });

        const expense = rows[0];
        // Only creator can delete
        if (expense.paid_by !== req.user.userId) {
            return res.status(403).json({ error: 'Permission denied: Only the expense creator can delete this.' });
        }

        // Notify all members before deletion
        const [members] = await db.query(
            'SELECT gm.user_id FROM group_members gm WHERE gm.group_id = (SELECT group_id FROM expenses WHERE id = ?)',
            [expenseId]
        );
        const description = expense.id ? (await db.query('SELECT description FROM expenses WHERE id = ?', [expenseId]))[0][0].description : 'Unknown Expense';
        
        await db.query('DELETE FROM expenses WHERE id = ?', [expenseId]);

        const [groupRows] = await db.query('SELECT group_id FROM expenses WHERE id = ?', [expenseId]);
        const finalGroupId = groupRows.length ? groupRows[0].group_id : null;

        const msg = `Notice: The expense "${description}" has been deleted. Associated debts have been reversed.`;
        for (let m of members) {
            await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [m.user_id, msg]);
            socketService.emitToUser(m.user_id, 'update_notifications');
        }

        const memberIds = members.map(m => m.user_id);
        socketService.emitToGroup(finalGroupId, memberIds, 'update_expenses', { groupId: finalGroupId, action: 'deleted' });
        socketService.emitToGroup(finalGroupId, memberIds, 'update_summary', { groupId: finalGroupId });

        res.json({ message: 'Expense deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Edit expense (Creator or Admin)
router.put('/:expenseId', async (req, res) => {
    try {
        const expenseId = req.params.expenseId;
        const { amount, description, splits } = req.body;
        const userId = req.user.userId;

        const [rows] = await db.query(
            `SELECT e.paid_by, eg.admin_id FROM expenses e 
             JOIN expense_groups eg ON e.group_id = eg.id 
             WHERE e.id = ?`, [expenseId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Expense not found' });
        
        const expense = rows[0];
        if (expense.paid_by !== userId && expense.admin_id !== userId) {
            return res.status(403).json({ error: 'Permission denied' });
        }
        if (expense.is_wrong) {
            return res.status(403).json({ error: 'Cannot edit: This entry is marked as WRONG by the admin. Please delete it or wait for admin review.' });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            await connection.query('UPDATE expenses SET amount = ?, description = ? WHERE id = ?', [amount, description, expenseId]);
            
            if (splits && splits.length > 0) {
                await connection.query('DELETE FROM expense_splits WHERE expense_id = ?', [expenseId]);
                for (let split of splits) {
                    await connection.query('INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES (?, ?, ?)', [expenseId, split.userId, split.amount_owed]);
                }
            }
            await connection.commit();

            const [groupRows] = await db.query('SELECT group_id FROM expenses WHERE id = ?', [expenseId]);
            const groupId = groupRows[0].group_id;
            const [members] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
            const memberIds = members.map(m => m.user_id);
            
            socketService.emitToGroup(groupId, memberIds, 'update_expenses', { groupId, action: 'updated' });
            socketService.emitToGroup(groupId, memberIds, 'update_summary', { groupId });

            res.json({ message: 'Expense updated' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Mark as wrong (Admin only)
router.post('/:expenseId/mark-wrong', async (req, res) => {
    try {
        const expenseId = req.params.expenseId;
        const { isWrong } = req.body;
        const userId = req.user.userId;

        const [rows] = await db.query(
            'SELECT eg.admin_id FROM expenses e JOIN expense_groups eg ON e.group_id = eg.id WHERE e.id = ?',
            [expenseId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Expense not found' });
        
        if (rows[0].admin_id !== userId) {
            return res.status(403).json({ error: 'Only the group admin can mark entries as wrong.' });
        }

        await db.query('UPDATE expenses SET is_wrong = ? WHERE id = ?', [!!isWrong, expenseId]);

        // Notify all members
        const [members] = await db.query(
            'SELECT gm.user_id FROM group_members gm JOIN expenses e ON gm.group_id = e.group_id WHERE e.id = ?',
            [expenseId]
        );
        const [expRows] = await db.query('SELECT description, paid_by FROM expenses WHERE id = ?', [expenseId]);
        const { description, paid_by } = expRows[0];
        const statusMsg = isWrong ? 'WRONG' : 'CORRECT';
        
        // General message for group
        const msg = `Notice: Admin marked the expense "${description}" as ${statusMsg}. Associated debts have been ${isWrong ? 'resolved' : 're-instated'}.`;
        
        // Specific message for creator
        const creatorMsg = isWrong ? `Admin flagged your entry "${description}" as WRONG.` : `Admin marked your entry "${description}" as CORRECT.`;

        for (let m of members) {
            const finalMsg = (m.user_id === paid_by) ? creatorMsg : msg;
            await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)', [m.user_id, finalMsg]);
            socketService.emitToUser(m.user_id, 'update_notifications');
        }

        const [groupRows] = await db.query('SELECT group_id FROM expenses WHERE id = ?', [expenseId]);
        const groupId = groupRows[0].group_id;
        socketService.emitToGroup(groupId, members.map(m => m.user_id), 'update_expenses', { groupId, action: 'mark_wrong' });
        socketService.emitToGroup(groupId, members.map(m => m.user_id), 'update_summary', { groupId });

        res.json({ message: isWrong ? 'Entry marked as wrong' : 'Entry marked as correct' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Hide expense (Delete for Me)
router.post('/:expenseId/hide', async (req, res) => {
    try {
        const expenseId = req.params.expenseId;
        const userId = req.user.userId;

        await db.query('INSERT IGNORE INTO user_hidden_activities (user_id, expense_id) VALUES (?, ?)', [userId, expenseId]);
        res.json({ message: 'Entry hidden for you' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});


router.get('/:groupId/settlements', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const [expenses] = await db.query(`
            SELECT
                e.id as expense_id,
                e.paid_by,
                e.amount,
                e.description,
                e.created_at,
                es.user_id as owed_by,
                es.amount_owed,
                u_paid.username as paid_by_name,
                u_owed.username as owed_by_name
            FROM expenses e
            JOIN expense_splits es ON e.id = es.expense_id
            JOIN users u_paid ON e.paid_by = u_paid.id
            JOIN users u_owed ON es.user_id = u_owed.id
            WHERE e.group_id = ? AND e.is_wrong = 0
        `, [groupId]);

        const balances = {};
        const details = [];

        for (let row of expenses) {
            if (!balances[row.paid_by]) balances[row.paid_by] = 0;
            if (!balances[row.owed_by]) balances[row.owed_by] = 0;

            balances[row.paid_by] += parseFloat(row.amount_owed);
            balances[row.owed_by] -= parseFloat(row.amount_owed);

            details.push({
                expense_id: row.expense_id,
                description: row.description,
                date: row.created_at,
                payer_id: row.paid_by,
                payer_name: row.paid_by_name,
                debtor_id: row.owed_by,
                debtor_name: row.owed_by_name,
                amount: parseFloat(row.amount_owed)
            });
        }

        res.json({ balances, details });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/:groupId/settle', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { toUserId, fromUserId, amount } = req.body;
        const actingUserId = req.user.userId;

        // Use fromUserId if provided, otherwise default to current user as the payer
        const actualFromId = fromUserId || actingUserId;

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            const [users] = await connection.query('SELECT username FROM users WHERE id = ?', [toUserId]);
            const toUsername = users[0]?.username || 'User';
            const description = `Settlement Payment to ${toUsername}`;

            const [expResult] = await connection.query(
                'INSERT INTO expenses (group_id, paid_by, amount, description) VALUES (?, ?, ?, ?)',
                [groupId, actualFromId, amount, description]
            );
            const expenseId = expResult.insertId;

            await connection.query(
                'INSERT INTO expense_splits (expense_id, user_id, amount_owed) VALUES (?, ?, ?)',
                [expenseId, toUserId, amount]
            );

            await connection.commit();

            const [members] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
            const memberIds = members.map(m => m.user_id);
            socketService.emitToGroup(groupId, memberIds, 'update_expenses', { groupId, action: 'settled' });
            socketService.emitToGroup(groupId, memberIds, 'update_summary', { groupId });
            socketService.emitToUser(toUserId, 'update_notifications');

            res.status(201).json({ message: 'Settlement recorded' });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
