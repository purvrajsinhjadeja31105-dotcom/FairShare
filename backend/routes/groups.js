const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMid = require('../middleware/authMiddleware');
const socketService = require('../services/socketService');

router.use(authMid);

router.post('/', async (req, res) => {
    try {
        const { name, is_personal, members } = req.body;
        
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            const isAdminForPersonal = !!is_personal;
            const [grpResult] = await connection.query(
                'INSERT INTO expense_groups (name, is_personal, created_by, admin_id) VALUES (?, ?, ?, ?)', 
                [name || 'Personal Group', isAdminForPersonal, req.user.userId, isAdminForPersonal ? req.user.userId : null]
            );
            const groupId = grpResult.insertId;
            
            const memberSet = new Set(members || []);
            memberSet.add(req.user.userId);

            for (let uid of memberSet) {
                await connection.query('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, uid]);
            }
            
            await connection.commit();
            
            // Notify members
            const membersToNotify = Array.from(memberSet);
            socketService.emitToGroup(groupId, membersToNotify, 'update_groups', { groupId, action: 'created' });

            res.status(201).json({ message: 'Group created', groupId });
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/', async (req, res) => {
    try {
        const [groups] = await db.query(`
            SELECT eg.*, COUNT(DISTINCT gm_all.user_id) as member_count
            FROM expense_groups eg
            JOIN group_members gm_me ON eg.id = gm_me.group_id
            JOIN group_members gm_all ON eg.id = gm_all.group_id
            WHERE gm_me.user_id = ?
            GROUP BY eg.id
            ORDER BY eg.created_at DESC
        `, [req.user.userId]);
        res.json({ groups });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/:groupId/members', async (req, res) => {
    try {
        const { email, userId } = req.body;
        const groupId = req.params.groupId;

        let finalUserId = userId;

        if (!finalUserId && email) {
            const [users] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
            if (users.length === 0) return res.status(404).json({ error: 'User not found' });
            finalUserId = users[0].id;
        }

        if (!finalUserId) return res.status(400).json({ error: 'User identifier required' });
        
        await db.query('INSERT IGNORE INTO group_members (group_id, user_id) VALUES (?, ?)', [groupId, finalUserId]);
        
        // Notify the new member and existing members
        const [allMembers] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
        const memberIds = allMembers.map(m => m.user_id);
        socketService.emitToGroup(groupId, memberIds, 'update_groups', { groupId, action: 'member_added' });

        res.status(200).json({ message: 'Member added' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/:groupId/members', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const [members] = await db.query(`
            SELECT u.id, u.username, u.email
            FROM users u
            JOIN group_members gm ON u.id = gm.user_id
            WHERE gm.group_id = ?
        `, [groupId]);
        res.json({ members });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/:groupId', async (req, res) => {
    try {
        const [results] = await db.query('SELECT eg.*, u.username as admin_name FROM expense_groups eg LEFT JOIN users u ON eg.admin_id = u.id WHERE eg.id = ?', [req.params.groupId]);
        if (results.length === 0) return res.status(404).json({ error: 'Group not found' });
        res.json({ group: results[0] });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin Polling Routes

router.get('/:groupId/active-poll', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const [polls] = await db.query(
            'SELECT * FROM group_admin_polls WHERE group_id = ? AND status = "active" ORDER BY created_at DESC LIMIT 1',
            [groupId]
        );
        
        if (polls.length === 0) return res.json({ poll: null });

        const pollId = polls[0].id;

        // Get votes count per candidate
        const [voteCounts] = await db.query(`
            SELECT candidate_id, u.username as candidate_name, COUNT(*) as votes
            FROM poll_votes pv
            JOIN users u ON pv.candidate_id = u.id
            WHERE poll_id = ?
            GROUP BY candidate_id
        `, [pollId]);

        // Get user's own vote
        const [myVote] = await db.query('SELECT candidate_id FROM poll_votes WHERE poll_id = ? AND voter_id = ?', [pollId, req.user.userId]);

        res.json({
            poll: {
                ...polls[0],
                votes: voteCounts,
                myVote: myVote.length > 0 ? myVote[0].candidate_id : null
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/:groupId/poll', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const userId = req.user.userId;

        // Mark existing active polls as expired
        await db.query('UPDATE group_admin_polls SET status = "expired" WHERE group_id = ? AND status = "active"', [groupId]);

        // Start new poll
        const [result] = await db.query(
            'INSERT INTO group_admin_polls (group_id, started_by) VALUES (?, ?)',
            [groupId, userId]
        );

        // Notify group members about new poll
        const [members] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
        socketService.emitToGroup(groupId, members.map(m => m.user_id), 'update_poll', { groupId, pollId: result.insertId });

        res.status(201).json({ message: 'Poll started', pollId: result.insertId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/:groupId/vote', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const { pollId, candidateId } = req.body;
        const userId = req.user.userId;

        // 1. Check if poll exists and is active
        const [polls] = await db.query('SELECT status FROM group_admin_polls WHERE id = ?', [pollId]);
        if (polls.length === 0 || polls[0].status !== 'active') {
            return res.status(400).json({ error: 'Poll is not active' });
        }

        // 2. Cast or update vote
        await db.query(`
            INSERT INTO poll_votes (poll_id, voter_id, candidate_id)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE candidate_id = VALUES(candidate_id)
        `, [pollId, userId, candidateId]);

        // 3. Check for majority
        const [memberCountResult] = await db.query('SELECT COUNT(*) as count FROM group_members WHERE group_id = ?', [groupId]);
        const groupMemberCount = memberCountResult[0].count;
        const majorityThreshold = Math.floor(groupMemberCount / 2) + 1;

        const [voteCounts] = await db.query(
            'SELECT COUNT(*) as count FROM poll_votes WHERE poll_id = ? AND candidate_id = ?',
            [pollId, candidateId]
        );
        const currentVotes = voteCounts[0].count;

        if (currentVotes >= majorityThreshold) {
            // Majority reached! Promote to admin
            await db.query('UPDATE expense_groups SET admin_id = ? WHERE id = ?', [candidateId, groupId]);
            await db.query('UPDATE group_admin_polls SET status = "completed" WHERE id = ?', [pollId]);
            
            // Notify members about admin update
            const [members] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
            socketService.emitToGroup(groupId, members.map(m => m.user_id), 'update_groups', { groupId, action: 'admin_updated' });
            socketService.emitToGroup(groupId, members.map(m => m.user_id), 'update_poll', { groupId, pollId, action: 'completed' });

            return res.json({ message: 'Majority reached! Admin updated.', promoted: true });
        }

        // Notify members about new vote
        const [members] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
        socketService.emitToGroup(groupId, members.map(m => m.user_id), 'update_poll', { groupId, pollId, action: 'voted' });

        res.json({ message: 'Vote cast successfully', promoted: false });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/:groupId/leave', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const userId = req.user.userId;

        await db.query('DELETE FROM group_members WHERE group_id = ? AND user_id = ?', [groupId, userId]);
        
        // If no members left, delete the group
        const [remaining] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
        if (remaining.length === 0) {
            await db.query('DELETE FROM expense_groups WHERE id = ?', [groupId]);
        } else {
            // Notify remaining members
            socketService.emitToGroup(groupId, remaining.map(m => m.user_id), 'update_groups', { groupId, action: 'member_left' });
        }
        
        res.status(200).json({ message: 'Left group successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.delete('/:groupId', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const userId = req.user.userId;

        const [results] = await db.query('SELECT created_by FROM expense_groups WHERE id = ?', [groupId]);
        if (results.length === 0) return res.status(404).json({ error: 'Group not found' });

        if (results[0].created_by !== userId) {
            return res.status(403).json({ error: 'Only the creator can delete the group' });
        }

        const [members] = await db.query('SELECT user_id FROM group_members WHERE group_id = ?', [groupId]);
        await db.query('DELETE FROM expense_groups WHERE id = ?', [groupId]);
        
        // Notify members before they lose access (room will still work for a moment)
        socketService.emitToGroup(groupId, members.map(m => m.user_id), 'update_groups', { groupId, action: 'deleted' });

        res.status(200).json({ message: 'Group deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
