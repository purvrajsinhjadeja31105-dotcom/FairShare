const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { FieldValue, FieldPath } = require('firebase-admin/firestore');
const authMid = require('../middleware/authMiddleware');
const socketService = require('../services/socketService');
const { validateBody } = require('../middleware/validate');
const { createGroupSchema, addMemberSchema, voteSchema } = require('../validation/groupValidation');

router.use(authMid);

router.post('/', validateBody(createGroupSchema), async (req, res, next) => {
    try {
        const { name, is_personal, members } = req.body;
        const userId = req.user.userId;
        const isAdminForPersonal = !!is_personal;

        const memberSet = new Set(members || []);
        memberSet.add(userId);
        const membersArray = Array.from(memberSet);

        const newGroupRef = await db.collection('groups').add({
            name: name || 'Personal Group',
            is_personal: isAdminForPersonal,
            created_by: userId,
            admin_id: isAdminForPersonal ? userId : null,
            members: membersArray,
            created_at: FieldValue.serverTimestamp()
        });

        const groupId = newGroupRef.id;

        socketService.emitToGroup(groupId, membersArray, 'update_groups', { groupId, action: 'created' });

        res.status(201).json({ message: 'Group created', groupId });
    } catch (err) {
        next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const snapshot = await db.collection('groups')
            .where('members', 'array-contains', userId)
            .get();

        const groups = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            groups.push({
                id: doc.id,
                ...data,
                member_count: data.members ? data.members.length : 0,
                created_at: data.created_at ? data.created_at.toDate() : null
            });
        });

        // Sort in-memory descending by created_at
        groups.sort((a, b) => {
            const timeA = a.created_at ? a.created_at.getTime() : 0;
            const timeB = b.created_at ? b.created_at.getTime() : 0;
            return timeB - timeA;
        });

        res.json({ groups });
    } catch (err) {
        next(err);
    }
});

router.post('/:groupId/members', validateBody(addMemberSchema), async (req, res, next) => {
    try {
        const { email, userId } = req.body;
        const groupId = req.params.groupId;

        let finalUserId = userId;

        if (!finalUserId && email) {
            const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
            if (usersSnap.empty) return res.status(404).json({ error: 'User not found' });
            finalUserId = usersSnap.docs[0].id;
        }

        if (!finalUserId) return res.status(400).json({ error: 'User identifier required' });

        const groupRef = db.collection('groups').doc(groupId);
        await groupRef.update({
            members: FieldValue.arrayUnion(finalUserId)
        });

        const groupDoc = await groupRef.get();
        const allMembers = groupDoc.data().members || [];
        
        socketService.emitToGroup(groupId, allMembers, 'update_groups', { groupId, action: 'member_added' });

        res.status(200).json({ message: 'Member added' });
    } catch (err) {
        next(err);
    }
});

router.get('/:groupId/members', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const groupDoc = await db.collection('groups').doc(groupId).get();
        
        if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });
        
        const memberIds = groupDoc.data().members || [];
        
        if (memberIds.length === 0) return res.json({ members: [] });

        // Firestore 'in' queries support max 30 items. We split if necessary.
        const members = [];
        for (let i = 0; i < memberIds.length; i += 30) {
            const chunk = memberIds.slice(i, i + 30);
            const usersSnap = await db.collection('users').where(FieldPath.documentId(), 'in', chunk).get();
            usersSnap.forEach(doc => {
                members.push({ id: doc.id, username: doc.data().username, email: doc.data().email });
            });
        }

        res.json({ members });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/:groupId', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const groupDoc = await db.collection('groups').doc(groupId).get();
        if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });
        
        const groupData = groupDoc.data();
        let admin_name = null;

        if (groupData.admin_id) {
            const adminDoc = await db.collection('users').doc(groupData.admin_id).get();
            if (adminDoc.exists) {
                admin_name = adminDoc.data().username;
            }
        }

        res.json({ group: { id: groupDoc.id, ...groupData, admin_name } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Admin Polling Routes

router.get('/:groupId/active-poll', async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        const pollsSnap = await db.collection('groups').doc(groupId).collection('polls')
            .where('status', '==', 'active')
            .get();
        
        if (pollsSnap.empty) return res.json({ poll: null });

        const polls = [];
        pollsSnap.forEach(doc => {
            polls.push({ id: doc.id, data: doc.data() });
        });

        // Sort in-memory descending by created_at
        polls.sort((a, b) => {
            const timeA = a.data.created_at ? a.data.created_at.toDate().getTime() : 0;
            const timeB = b.data.created_at ? b.data.created_at.toDate().getTime() : 0;
            return timeB - timeA;
        });

        const pollDoc = polls[0];
        const pollId = pollDoc.id;
        const pollData = pollDoc.data;

        // Get votes
        const votesSnap = await db.collection('groups').doc(groupId).collection('polls').doc(pollId).collection('votes').get();
        
        const voteCountsMap = {};
        let myVote = null;

        for (const voteDoc of votesSnap.docs) {
            const vData = voteDoc.data();
            if (vData.voter_id === req.user.userId) {
                myVote = vData.candidate_id;
            }
            if (!voteCountsMap[vData.candidate_id]) {
                voteCountsMap[vData.candidate_id] = 0;
            }
            voteCountsMap[vData.candidate_id]++;
        }

        const voteCounts = [];
        for (const [candidateId, votes] of Object.entries(voteCountsMap)) {
            const candDoc = await db.collection('users').doc(candidateId).get();
            voteCounts.push({
                candidate_id: candidateId,
                candidate_name: candDoc.exists ? candDoc.data().username : 'Unknown',
                votes: votes
            });
        }

        res.json({
            poll: {
                id: pollId,
                ...pollData,
                votes: voteCounts,
                myVote: myVote
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

        const pollsRef = db.collection('groups').doc(groupId).collection('polls');
        
        // Mark existing active polls as expired
        const activePolls = await pollsRef.where('status', '==', 'active').get();
        const batch = db.batch();
        activePolls.forEach(doc => {
            batch.update(doc.ref, { status: 'expired' });
        });
        await batch.commit();

        // Start new poll
        const newPollRef = await pollsRef.add({
            started_by: userId,
            status: 'active',
            created_at: FieldValue.serverTimestamp()
        });

        const groupDoc = await db.collection('groups').doc(groupId).get();
        const members = groupDoc.exists ? groupDoc.data().members || [] : [];
        
        socketService.emitToGroup(groupId, members, 'update_poll', { groupId, pollId: newPollRef.id });

        res.status(201).json({ message: 'Poll started', pollId: newPollRef.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/:groupId/vote', validateBody(voteSchema), async (req, res, next) => {
    try {
        const groupId = req.params.groupId;
        const { pollId, candidateId } = req.body;
        const userId = req.user.userId;

        const pollRef = db.collection('groups').doc(groupId).collection('polls').doc(pollId);
        const pollDoc = await pollRef.get();

        if (!pollDoc.exists || pollDoc.data().status !== 'active') {
            return res.status(400).json({ error: 'Poll is not active' });
        }

        // Cast or update vote
        await pollRef.collection('votes').doc(userId).set({
            voter_id: userId,
            candidate_id: candidateId,
            created_at: FieldValue.serverTimestamp()
        });

        // Check for majority
        const groupDoc = await db.collection('groups').doc(groupId).get();
        const members = groupDoc.data().members || [];
        const majorityThreshold = Math.floor(members.length / 2) + 1;

        const votesSnap = await pollRef.collection('votes').where('candidate_id', '==', candidateId).get();
        const currentVotes = votesSnap.size;

        if (currentVotes >= majorityThreshold) {
            // Majority reached! Promote to admin
            const batch = db.batch();
            batch.update(db.collection('groups').doc(groupId), { admin_id: candidateId });
            batch.update(pollRef, { status: 'completed' });
            await batch.commit();
            
            socketService.emitToGroup(groupId, members, 'update_groups', { groupId, action: 'admin_updated' });
            socketService.emitToGroup(groupId, members, 'update_poll', { groupId, pollId, action: 'completed' });

            return res.json({ message: 'Majority reached! Admin updated.', promoted: true });
        }

        socketService.emitToGroup(groupId, members, 'update_poll', { groupId, pollId, action: 'voted' });

        res.json({ message: 'Vote cast successfully', promoted: false });
    } catch (err) {
        next(err);
    }
});

router.post('/:groupId/leave', async (req, res) => {
    try {
        const groupId = req.params.groupId;
        const userId = req.user.userId;

        const groupRef = db.collection('groups').doc(groupId);
        await groupRef.update({
            members: FieldValue.arrayRemove(userId)
        });
        
        const groupDoc = await groupRef.get();
        const remaining = groupDoc.data().members || [];

        if (remaining.length === 0) {
            await groupRef.delete();
        } else {
            socketService.emitToGroup(groupId, remaining, 'update_groups', { groupId, action: 'member_left' });
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

        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();
        
        if (!groupDoc.exists) return res.status(404).json({ error: 'Group not found' });

        if (groupDoc.data().created_by !== userId) {
            return res.status(403).json({ error: 'Only the creator can delete the group' });
        }

        const members = groupDoc.data().members || [];
        await groupRef.delete();
        
        socketService.emitToGroup(groupId, members, 'update_groups', { groupId, action: 'deleted' });

        res.status(200).json({ message: 'Group deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
