const { db, clearDb, createUser, createGroup, as } = require('./helpers');

let asha, bala, chen, trip;
const split = (...pairs) => pairs.map(([user, amount_owed]) => ({ userId: user.id, amount_owed }));

beforeEach(async () => {
    await clearDb();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    [asha, bala, chen] = await Promise.all([
        createUser({ username: 'asha', email: 'asha@test.com' }),
        createUser({ username: 'bala', email: 'bala@test.com' }),
        createUser({ username: 'chen', email: 'chen@test.com' })
    ]);
    trip = await createGroup({ name: 'Goa', creator: asha, members: [asha, bala, chen] });
});
afterEach(() => jest.restoreAllMocks());

describe('adding expenses', () => {
    test('anyone in the group can be recorded as the payer', async () => {
        const res = await as(asha).post(`/api/expenses/${trip}`, {
            amount: 300, description: 'Hotel', paidBy: bala.id, splits: split([asha, 100], [bala, 100], [chen, 100])
        });
        expect(res.status).toBe(201);
        const { balances } = (await as(asha).get(`/api/expenses/${trip}/settlements`)).body;
        expect(balances).toEqual({ [bala.id]: 200, [asha.id]: -100, [chen.id]: -100 });
    });

    test('unequal splits are stored as one expense', async () => {
        await as(asha).post(`/api/expenses/${trip}`, {
            amount: 1000, description: 'Tickets', splits: split([asha, 500], [bala, 300], [chen, 200])
        });
        const { expenses } = (await as(asha).get(`/api/expenses/${trip}/all`)).body;
        expect(expenses).toHaveLength(1);
        expect(expenses[0].splits.map(s => s.amount)).toEqual([500, 300, 200]);
    });

    test('stores the expense date, defaulting to today', async () => {
        await as(asha).post(`/api/expenses/${trip}`, { amount: 30, description: 'Tea', date: '2026-09-01', splits: split([asha, 15], [bala, 15]) });
        await as(asha).post(`/api/expenses/${trip}`, { amount: 30, description: 'Snacks', splits: split([asha, 15], [bala, 15]) });

        const { expenses } = (await as(asha).get(`/api/expenses/${trip}/all`)).body;
        expect(expenses.find(e => e.description === 'Tea').expense_date).toBe('2026-09-01');
        expect(expenses.find(e => e.description === 'Snacks').expense_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('rejects impossible dates', async () => {
        const res = await as(asha).post(`/api/expenses/${trip}`, { amount: 30, description: 'x', date: '2026-02-30', splits: split([asha, 30]) });
        expect(res.status).toBe(400);
    });
});

describe('editing and deleting', () => {
    test('the person who added an expense can edit it even if someone else paid', async () => {
        const { body } = await as(asha).post(`/api/expenses/${trip}`, { amount: 60, description: 'Fuel', paidBy: bala.id, splits: split([asha, 30], [bala, 30]) });

        expect((await as(asha).put(`/api/expenses/${body.expenseId}`, { description: 'Petrol' })).status).toBe(200); // added it
        expect((await as(bala).put(`/api/expenses/${body.expenseId}`, { date: '2026-09-20' })).status).toBe(200);    // paid for it
        expect((await as(chen).put(`/api/expenses/${body.expenseId}`, { description: 'x' })).status).toBe(403);     // neither

        const stored = (await db.collection('expenses').doc(body.expenseId).get()).data();
        expect(stored).toMatchObject({ description: 'Petrol', expense_date: '2026-09-20' });
    });

    test('the payer can be changed to another member, and balances follow', async () => {
        const { body } = await as(asha).post(`/api/expenses/${trip}`, { amount: 60, description: 'Fuel', splits: split([asha, 30], [bala, 30]) });

        expect((await as(asha).put(`/api/expenses/${body.expenseId}`, { paidBy: bala.id })).status).toBe(200);
        expect((await as(asha).get(`/api/expenses/${trip}/settlements`)).body.balances).toEqual({ [bala.id]: 30, [asha.id]: -30 });

        const outsider = await createUser({ username: 'zed', email: 'zed@test.com' });
        expect((await as(asha).put(`/api/expenses/${body.expenseId}`, { paidBy: outsider.id })).status).toBe(400);
    });

    test('payments cannot be edited, only deleted', async () => {
        await as(asha).post(`/api/expenses/${trip}`, { amount: 60, description: 'Fuel', splits: split([asha, 30], [bala, 30]) });
        const { body } = await as(bala).post(`/api/expenses/${trip}/settle`, { toUserId: asha.id, amount: 30 });

        expect((await as(bala).put(`/api/expenses/${body.settlementId}`, { amount: 1 })).status).toBe(400);
        expect((await as(bala).delete(`/api/expenses/${body.settlementId}`)).status).toBe(200);
    });

    test('removed routes are gone', async () => {
        const { body } = await as(asha).post(`/api/expenses/${trip}`, { amount: 60, description: 'Fuel', splits: split([asha, 30], [bala, 30]) });
        expect((await as(asha).post(`/api/expenses/${body.expenseId}/mark-wrong`, { isWrong: true })).status).toBe(404);
        expect((await as(asha).post(`/api/expenses/${body.expenseId}/hide`)).status).toBe(404);
        expect((await as(asha).post(`/api/groups/${trip}/poll`)).status).toBe(404);
    });
});

describe('home overview', () => {
    test('shows total, people, groups and pending payments, consistent with the group screen', async () => {
        const flat = await createGroup({ name: 'Flat', creator: bala, members: [asha, bala] });
        await as(asha).post(`/api/expenses/${trip}`, { amount: 300, description: 'Hotel', splits: split([asha, 100], [bala, 100], [chen, 100]) });
        await as(bala).post(`/api/expenses/${flat}`, { amount: 80, description: 'Groceries', splits: split([asha, 40], [bala, 40]) });
        await as(chen).post(`/api/expenses/${trip}/settle`, { toUserId: asha.id, amount: 100 }); // pending

        const res = await as(asha).get('/api/expenses/overview');

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(160);
        expect(res.body.groups.map(g => [g.name, g.my_balance]).sort()).toEqual([['Flat', -40], ['Goa', 200]]);
        expect(res.body.people.find(p => p.userId === bala.id)).toMatchObject({
            username: 'bala', balance: 60,
            groups: expect.arrayContaining([
                { groupId: trip, groupName: 'Goa', amount: 100 },
                { groupId: flat, groupName: 'Flat', amount: -40 }
            ])
        });
        expect(res.body.pendingForYou).toEqual([expect.objectContaining({ fromUserName: 'chen', amount: 100, groupName: 'Goa' })]);

        // the same numbers as the group screen's suggested payments
        const { simplifiedDebts } = (await as(asha).get(`/api/expenses/${trip}/settlements`)).body;
        const balaToAsha = simplifiedDebts.find(d => d.fromUserId === bala.id && d.toUserId === asha.id);
        expect(balaToAsha.amount).toBe(100);
    });

    test('a new user with no groups is all settled', async () => {
        const dev = await createUser({ username: 'dev', email: 'dev@test.com' });
        expect((await as(dev).get('/api/expenses/overview')).body).toEqual({ total: 0, people: [], groups: [], pendingForYou: [], pendingByYou: [] });
    });
});
