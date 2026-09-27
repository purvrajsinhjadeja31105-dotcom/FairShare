const { db, clearDb, createUser, createGroup, as } = require('./helpers');

let asha, bala, chen;
const split = (...pairs) => pairs.map(([user, amount_owed]) => ({ userId: user.id, amount_owed }));

beforeEach(async () => {
    await clearDb();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    [asha, bala, chen] = await Promise.all([
        createUser({ username: 'asha', email: 'asha@test.com' }),
        createUser({ username: 'bala', email: 'bala@test.com' }),
        createUser({ username: 'chen', email: 'chen@test.com' })
    ]);
});
afterEach(() => jest.restoreAllMocks());

const newGroup = async (user = asha, name = 'Goa Trip') => (await as(user).post('/api/groups', { name })).body.groupId;
const inviteCodeOf = async (user, groupId) => (await as(user).get(`/api/groups/${groupId}/invite`)).body.code;

describe('creating a group', () => {
    test('a new group can take expenses straight away (no admin or election needed)', async () => {
        const groupId = await newGroup();
        const code = await inviteCodeOf(asha, groupId);
        await as(bala).post(`/api/groups/invite/${code}/join`);

        const res = await as(bala).post(`/api/expenses/${groupId}`, { amount: 100, description: 'Fuel', splits: split([asha, 50], [bala, 50]) });
        expect(res.status).toBe(201);
    });

    test('only the creator starts as a member; member IDs in the request are ignored', async () => {
        const res = await as(asha).post('/api/groups', { name: 'Trip', members: [bala.id, chen.id] });
        const group = (await as(asha).get(`/api/groups/${res.body.groupId}`)).body.group;
        expect(group.members).toEqual([asha.id]);
        expect(group).not.toHaveProperty('admin_id');
    });

    test('legacy personal-tracker groups are not listed', async () => {
        await createGroup({ name: 'Personal Tracker', creator: asha, members: [asha], is_personal: true });
        await newGroup();
        const { groups } = (await as(asha).get('/api/groups')).body;
        expect(groups.map(g => g.name)).toEqual(['Goa Trip']);
    });
});

describe('invite links', () => {
    test('preview shows the group, then joining adds you', async () => {
        const groupId = await newGroup();
        const code = await inviteCodeOf(asha, groupId);

        const preview = await as(bala).get(`/api/groups/invite/${code}`);
        expect(preview.status).toBe(200);
        expect(preview.body).toEqual({
            group: { id: groupId, name: 'Goa Trip', member_count: 1, created_by_name: 'asha' },
            alreadyMember: false
        });

        const join = await as(bala).post(`/api/groups/invite/${code}/join`);
        expect(join.body.groupId).toBe(groupId);
        expect((await as(bala).get(`/api/groups/invite/${code}`)).body.alreadyMember).toBe(true);
        expect((await as(bala).get('/api/groups')).body.groups.map(g => g.id)).toEqual([groupId]);
    });

    test('joining twice is harmless', async () => {
        const groupId = await newGroup();
        const code = await inviteCodeOf(asha, groupId);
        await as(bala).post(`/api/groups/invite/${code}/join`);
        await as(bala).post(`/api/groups/invite/${code}/join`);
        expect((await as(asha).get(`/api/groups/${groupId}`)).body.group.members).toEqual([asha.id, bala.id]);
    });

    test('invalid or unknown codes are rejected', async () => {
        expect((await as(bala).get('/api/groups/invite/not-a-code')).status).toBe(404);
        expect((await as(bala).post('/api/groups/invite/ABCDEFGHJKMN/join')).status).toBe(404);
    });

    test('non-members cannot read the invite code', async () => {
        const groupId = await newGroup();
        expect((await as(bala).get(`/api/groups/${groupId}/invite`)).status).toBe(403);
    });

    test('the creator can reset the link, which stops the old one working', async () => {
        const groupId = await newGroup();
        const oldCode = await inviteCodeOf(asha, groupId);

        const reset = await as(asha).post(`/api/groups/${groupId}/invite/reset`);
        expect(reset.status).toBe(200);
        expect(reset.body.code).not.toBe(oldCode);
        expect((await as(bala).post(`/api/groups/invite/${oldCode}/join`)).status).toBe(404);
        expect((await as(bala).post(`/api/groups/invite/${reset.body.code}/join`)).status).toBe(200);
    });

    test('only the creator can reset the link', async () => {
        const groupId = await newGroup();
        await as(bala).post(`/api/groups/invite/${await inviteCodeOf(asha, groupId)}/join`);
        expect((await as(bala).post(`/api/groups/${groupId}/invite/reset`)).status).toBe(403);
    });

    test('groups from before invite links get a code on first request', async () => {
        const groupId = await createGroup({ creator: asha, members: [asha], invite_code: null });
        const code = await inviteCodeOf(asha, groupId);
        expect(code).toHaveLength(12);
        expect(await inviteCodeOf(asha, groupId)).toBe(code); // stable afterwards
    });
});

describe('adding members by email', () => {
    test('adds an existing account', async () => {
        const groupId = await newGroup();
        expect((await as(asha).post(`/api/groups/${groupId}/members`, { email: 'bala@test.com' })).status).toBe(200);
        expect((await as(asha).get(`/api/groups/${groupId}`)).body.group.members).toContain(bala.id);
    });

    test('unknown email suggests the invite link', async () => {
        const groupId = await newGroup();
        const res = await as(asha).post(`/api/groups/${groupId}/members`, { email: 'nobody@test.com' });
        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/invite link/);
    });

    test('member list does not expose email addresses', async () => {
        const groupId = await createGroup({ creator: asha, members: [asha, bala] });
        const { members } = (await as(asha).get(`/api/groups/${groupId}/members`)).body;
        expect(members.map(m => m.username).sort()).toEqual(['asha', 'bala']);
        members.forEach(m => expect(m).not.toHaveProperty('email'));
    });
});

describe('leaving and deleting', () => {
    let groupId;
    beforeEach(async () => {
        groupId = await createGroup({ creator: asha, members: [asha, bala, chen] });
    });

    test('you cannot leave with an open balance', async () => {
        await as(asha).post(`/api/expenses/${groupId}`, { amount: 90, description: 'x', splits: split([asha, 30], [bala, 30], [chen, 30]) });
        const res = await as(bala).post(`/api/groups/${groupId}/leave`);
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Settle up/);
    });

    test('you can leave once settled', async () => {
        await as(asha).post(`/api/expenses/${groupId}`, { amount: 60, description: 'x', splits: split([asha, 30], [bala, 30]) });
        await as(asha).post(`/api/expenses/${groupId}/settle`, { fromUserId: bala.id, toUserId: asha.id, amount: 30 });

        expect((await as(bala).post(`/api/groups/${groupId}/leave`)).status).toBe(200);
        expect((await as(asha).get(`/api/groups/${groupId}`)).body.group.members).not.toContain(bala.id);
    });

    test('only the creator can delete, and only when everyone is settled', async () => {
        await as(asha).post(`/api/expenses/${groupId}`, { amount: 60, description: 'x', splits: split([asha, 30], [bala, 30]) });

        expect((await as(bala).delete(`/api/groups/${groupId}`)).status).toBe(403);
        expect((await as(asha).delete(`/api/groups/${groupId}`)).status).toBe(400);

        await as(asha).post(`/api/expenses/${groupId}/settle`, { fromUserId: bala.id, toUserId: asha.id, amount: 30 });
        expect((await as(asha).delete(`/api/groups/${groupId}`)).status).toBe(200);
        expect((await db.collection('groups').doc(groupId).get()).exists).toBe(false);
    });
});

describe('privacy', () => {
    test('there is no way to search or list other users (and their emails)', async () => {
        const res = await as(bala).get('/api/users/search?q=a');
        expect(res.status).toBe(404);
        expect(JSON.stringify(res.body)).not.toContain('asha@test.com');
    });
});
