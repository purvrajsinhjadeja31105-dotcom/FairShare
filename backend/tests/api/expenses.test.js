const { db, clearDb, createUser, createGroup, as } = require('./helpers');

const balancesOf = async (user, gid) => (await as(user).get(`/api/expenses/${gid}/settlements`)).body.balances;

let asha, bala, chen, outsider, groupId;
const split = (...pairs) => pairs.map(([user, amount_owed]) => ({ userId: user.id, amount_owed }));

beforeEach(async () => {
    await clearDb();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    [asha, bala, chen, outsider] = await Promise.all([
        createUser({ username: 'asha', email: 'asha@test.com' }),
        createUser({ username: 'bala', email: 'bala@test.com' }),
        createUser({ username: 'chen', email: 'chen@test.com' }),
        createUser({ username: 'zed', email: 'zed@test.com' })
    ]);
    groupId = await createGroup({ creator: asha, members: [asha, bala, chen] });
});
afterEach(() => jest.restoreAllMocks());

describe('creating expenses', () => {
    test('accepts splits that add up exactly', async () => {
        const res = await as(asha).post(`/api/expenses/${groupId}`, {
            amount: 100, description: 'Snacks', splits: split([asha, 33.34], [bala, 33.33], [chen, 33.33])
        });
        expect(res.status).toBe(201);
    });

    test('rejects splits that do not add up (the old 33.33 x 3 bug)', async () => {
        const res = await as(asha).post(`/api/expenses/${groupId}`, {
            amount: 100, description: 'Snacks', splits: split([asha, 33.33], [bala, 33.33], [chen, 33.33])
        });
        expect(res.status).toBe(400);
        expect(res.body.details[0].message).toMatch(/99\.99/);
    });

    test('rejects participants who are not in the group', async () => {
        const res = await as(asha).post(`/api/expenses/${groupId}`, {
            amount: 50, description: 'x', splits: split([outsider, 50])
        });
        expect(res.status).toBe(400);
    });

    test('non-members cannot read or write the group', async () => {
        expect((await as(outsider).get(`/api/expenses/${groupId}/all`)).status).toBe(403);
        expect((await as(outsider).post(`/api/expenses/${groupId}`, { amount: 1, description: 'x', splits: split([outsider, 1]) })).status).toBe(403);
    });
});

describe('editing expenses', () => {
    let expenseId;
    beforeEach(async () => {
        const res = await as(asha).post(`/api/expenses/${groupId}`, {
            amount: 90, description: 'Dinner', splits: split([asha, 30], [bala, 30], [chen, 30])
        });
        expenseId = res.body.expenseId;
    });

    test('changing only the description keeps amount and splits', async () => {
        expect((await as(asha).put(`/api/expenses/${expenseId}`, { description: 'Dinner at Thalassa' })).status).toBe(200);
        const stored = (await db.collection('expenses').doc(expenseId).get()).data();
        expect(stored.description).toBe('Dinner at Thalassa');
        expect(stored.amount).toBe(90);
        expect(stored.splits).toHaveLength(3);
    });

    test('changing the amount without matching splits is rejected', async () => {
        expect((await as(asha).put(`/api/expenses/${expenseId}`, { amount: 120 })).status).toBe(400);
    });

    test('someone who neither paid nor added it cannot edit', async () => {
        expect((await as(bala).put(`/api/expenses/${expenseId}`, { description: 'hacked' })).status).toBe(403);
    });
});

describe('balances and settlements', () => {
    beforeEach(async () => {
        await as(asha).post(`/api/expenses/${groupId}`, { amount: 300, description: 'Hotel', splits: split([asha, 100], [bala, 100], [chen, 100]) });
        await as(bala).post(`/api/expenses/${groupId}`, { amount: 100, description: 'Dinner', splits: split([asha, 33.34], [bala, 33.33], [chen, 33.33]) });
    });

    test('group balances always sum to zero and simplify to at most n-1 payments', async () => {
        const res = await as(asha).get(`/api/expenses/${groupId}/settlements`);
        expect(res.status).toBe(200);
        const total = Object.values(res.body.balances).reduce((sum, v) => sum + Math.round(v * 100), 0);
        expect(total).toBe(0);
        expect(res.body.simplifiedDebts.length).toBeLessThanOrEqual(2);
    });


    test('a member cannot record a payment between two other people', async () => {
        const res = await as(chen).post(`/api/expenses/${groupId}/settle`, { fromUserId: bala.id, toUserId: asha.id, amount: 10 });
        expect(res.status).toBe(400);
    });

    test('cannot settle with someone outside the group', async () => {
        expect((await as(asha).post(`/api/expenses/${groupId}/settle`, { toUserId: outsider.id, amount: 10 })).status).toBe(400);
    });
});

describe('home overview', () => {
    test('keeps people with the same username apart (keyed by user ID)', async () => {
        const rahul1 = await createUser({ username: 'rahul', email: 'r1@test.com' });
        const rahul2 = await createUser({ username: 'rahul', email: 'r2@test.com' });
        const g = await createGroup({ creator: asha, members: [asha, rahul1, rahul2] });
        await as(asha).post(`/api/expenses/${g}`, { amount: 30, description: 'x', splits: split([asha, 10], [rahul1, 10], [rahul2, 10]) });

        const { people } = (await as(asha).get('/api/expenses/overview')).body;

        expect(people.map(p => p.userId).sort()).toEqual([rahul1.id, rahul2.id].sort());
        people.forEach(p => expect(p).toMatchObject({ username: 'rahul', balance: 10, groups: [{ groupId: g, groupName: 'Trip', amount: 10 }] }));
    });
});
