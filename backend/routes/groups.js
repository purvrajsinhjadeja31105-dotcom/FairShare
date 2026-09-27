const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { FieldValue } = require('firebase-admin/firestore');
const authMid = require('../middleware/authMiddleware');
const socketService = require('../services/socketService');
const { validateBody } = require('../middleware/validate');
const { createGroupSchema, addMemberSchema } = require('../validation/groupValidation');
const { checkGroupMembership } = require('../middleware/membershipMiddleware');
const { groupBalancesPaise } = require('../services/balances');
const { fetchUsernames } = require('../utils/lookups');
const { createInviteCode, isValidInviteCode } = require('../utils/inviteCode');
const { joinLimiter } = require('../middleware/rateLimiters');

router.use(authMid);

const groupEntries = async (groupId) =>
    (await db.collection('expenses').where('group_id', '==', groupId).get()).docs.map(doc => doc.data());

// Everyone in a group is equal; the creator additionally manages the group (delete, reset invite link)
const toGroupResponse = (doc, extra = {}) => {
    const data = doc.data();
    return {
        id: doc.id,
        name: data.name,
        created_by: data.created_by,
        members: data.members || [],
        member_count: (data.members || []).length,
        created_at: data.created_at ? data.created_at.toDate() : null,
        ...extra
    };
};

router.post('/', validateBody(createGroupSchema), async (req, res, next) => {
    try {
        const { name } = req.body;
        const userId = req.user.userId;
        const membersArray = [userId];

        const newGroupRef = await db.collection('groups').add({
            name,
            created_by: userId,
            members: membersArray,
            invite_code: createInviteCode(),
            created_at: FieldValue.serverTimestamp()
        });

        socketService.emitToGroup(newGroupRef.id, membersArray, 'update_groups', { groupId: newGroupRef.id, action: 'created' });
        res.status(201).json({ message: 'Group created', groupId: newGroupRef.id });
    } catch (err) {
        next(err);
    }
});

router.get('/', async (req, res, next) => {
    try {
        const snapshot = await db.collection('groups')
            .where('members', 'array-contains', req.user.userId)
            .get();

        const groups = snapshot.docs
            .filter(doc => !doc.data().is_personal) // legacy one-person "Personal Tracker" groups are no longer shown
            .map(doc => toGroupResponse(doc))
            .sort((a, b) => (b.created_at?.getTime() || 0) - (a.created_at?.getTime() || 0));

        res.json({ groups });
    } catch (err) {
        next(err);
    }
});

// ---------- Invite links ----------
// Declared before the /:groupId routes so "invite" is never treated as a group ID.

const findGroupByInvite = async (code) => {
    if (!isValidInviteCode(code)) return null;
    const snapshot = await db.collection('groups').where('invite_code', '==', code).limit(1).get();
    return snapshot.empty ? null : snapshot.docs[0];
};

// Preview for the "You're invited to Goa Trip" page
router.get('/invite/:code', async (req, res, next) => {
    try {
        const groupDoc = await findGroupByInvite(req.params.code);
        if (!groupDoc) return res.status(404).json({ error: 'This invite link is invalid or has been reset. Ask for a new link.' });

        const group = groupDoc.data();
        const names = await fetchUsernames([group.created_by]);
        res.json({
            group: {
                id: groupDoc.id,
                name: group.name,
                member_count: (group.members || []).length,
                created_by_name: names[group.created_by]
            },
            alreadyMember: (group.members || []).includes(req.user.userId)
        });
    } catch (err) {
        next(err);
    }
});

router.post('/invite/:code/join', joinLimiter, async (req, res, next) => {
    try {
        const groupDoc = await findGroupByInvite(req.params.code);
        if (!groupDoc) return res.status(404).json({ error: 'This invite link is invalid or has been reset. Ask for a new link.' });

        const userId = req.user.userId;
        const members = groupDoc.data().members || [];
        if (!members.includes(userId)) {
            await groupDoc.ref.update({ members: FieldValue.arrayUnion(userId) });
            socketService.emitToGroup(groupDoc.id, [...members, userId], 'update_groups', { groupId: groupDoc.id, action: 'member_added' });
        }
        res.json({ message: 'Joined group', groupId: groupDoc.id });
    } catch (err) {
        next(err);
    }
});

router.get('/:groupId/invite', checkGroupMembership, async (req, res, next) => {
    try {
        let code = req.group.invite_code;
        if (!code) {
            // groups created before invite links existed get a code the first time someone asks
            code = createInviteCode();
            await req.groupDoc.ref.update({ invite_code: code });
        }
        res.json({ code });
    } catch (err) {
        next(err);
    }
});

// Creator can reset the link, e.g. if it was shared somewhere by mistake
router.post('/:groupId/invite/reset', checkGroupMembership, async (req, res, next) => {
    try {
        if (req.group.created_by !== req.user.userId) {
            return res.status(403).json({ error: 'Only the person who created the group can reset its invite link' });
        }
        const code = createInviteCode();
        await req.groupDoc.ref.update({ invite_code: code });
        res.json({ code });
    } catch (err) {
        next(err);
    }
});

// ---------- Members ----------

router.post('/:groupId/members', checkGroupMembership, validateBody(addMemberSchema), async (req, res, next) => {
    try {
        const { email } = req.body;
        const usersSnap = await db.collection('users').where('email', '==', email).limit(1).get();
        if (usersSnap.empty) {
            return res.status(404).json({ error: 'No FairShare account uses that email. Share the invite link instead.' });
        }

        const newMemberId = usersSnap.docs[0].id;
        await req.groupDoc.ref.update({ members: FieldValue.arrayUnion(newMemberId) });

        const allMembers = Array.from(new Set([...(req.group.members || []), newMemberId]));
        socketService.emitToGroup(req.params.groupId, allMembers, 'update_groups', { groupId: req.params.groupId, action: 'member_added' });
        res.json({ message: 'Member added' });
    } catch (err) {
        next(err);
    }
});

router.get('/:groupId/members', checkGroupMembership, async (req, res, next) => {
    try {
        const memberIds = req.group.members || [];
        if (memberIds.length === 0) return res.json({ members: [] });

        const docs = await db.getAll(...memberIds.map(id => db.collection('users').doc(id)));
        const members = docs.filter(doc => doc.exists).map(doc => ({
            id: doc.id,
            username: doc.data().username,
            upi_id: doc.data().upi_id || null
        }));

        res.json({ members });
    } catch (err) {
        next(err);
    }
});

router.get('/:groupId', checkGroupMembership, (req, res) => {
    res.json({ group: toGroupResponse(req.groupDoc) });
});

// ---------- Leaving and deleting ----------

router.post('/:groupId/leave', checkGroupMembership, async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const myBalance = groupBalancesPaise(await groupEntries(req.params.groupId))[userId] || 0;
        if (myBalance !== 0) {
            return res.status(400).json({ error: 'Settle up before leaving: you still have an open balance in this group.' });
        }

        const remaining = (req.group.members || []).filter(id => id !== userId);
        await req.groupDoc.ref.update({ members: FieldValue.arrayRemove(userId) });
        socketService.emitToGroup(req.params.groupId, remaining, 'update_groups', { groupId: req.params.groupId, action: 'member_left' });

        res.json({ message: 'Left group successfully' });
    } catch (err) {
        next(err);
    }
});

router.delete('/:groupId', checkGroupMembership, async (req, res, next) => {
    try {
        if (req.group.created_by !== req.user.userId) {
            return res.status(403).json({ error: 'Only the person who created the group can delete it' });
        }

        const balances = groupBalancesPaise(await groupEntries(req.params.groupId));
        if (Object.values(balances).some(paise => paise !== 0)) {
            return res.status(400).json({ error: 'Everyone needs to be settled up before the group can be deleted.' });
        }

        await req.groupDoc.ref.delete();
        socketService.emitToGroup(req.params.groupId, req.group.members || [], 'update_groups', { groupId: req.params.groupId, action: 'deleted' });

        res.json({ message: 'Group deleted successfully' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
