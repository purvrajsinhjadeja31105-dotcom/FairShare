const { db, clearDb, createUser, createGroup, as } = require('./helpers');

let asha, bala, chen, groupId;
const split = (...pairs) => pairs.map(([user, amount_owed]) => ({ userId: user.id, amount_owed }));
const balancesOf = async (user) => (await as(user).get(`/api/expenses/${groupId}/settlements`)).body.balances;
const auditFor = async (expenseId) => (await db.collection('audit_logs').where('expense_id', '==', expenseId).get()).docs.map(d => d.data());
const notificationsFor = async (user) => (await db.collection('notifications').where('user_id', '==', user.id).get()).docs.map(d => d.data().message);

beforeEach(async () => {
    await clearDb();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    [asha, bala, chen] = await Promise.all([
        createUser({ username: 'asha', email: 'asha@test.com' }),
        createUser({ username: 'bala', email: 'bala@test.com' }),
        createUser({ username: 'chen', email: 'chen@test.com' })
    ]);
    groupId = await createGroup({ admin: asha, members: [asha, bala, chen] });
    // asha paid 300 for everyone: bala and chen owe her 100 each
    await as(asha).post(`/api/expenses/${groupId}`, { amount: 300, description: 'Hotel', splits: split([asha, 100], [bala, 100], [chen, 100]) });
});
afterEach(() => jest.restoreAllMocks());

describe('two-sided settlements', () => {
    test('"I paid" stays pending and does not change balances until the receiver confirms', async () => {
        const res = await as(bala).post(`/api/expenses/${groupId}/settle`, { toUserId: asha.id, amount: 100 });

        expect(res.status).toBe(201);
        expect(res.body.status).toBe('pending');
        expect(res.body.message).toMatch(/asha needs to confirm/);
        expect((await balancesOf(asha))[bala.id]).toBe(-100);
        expect((await notificationsFor(asha)).some(m => m.includes('says they paid you ₹100.00'))).toBe(true);

        const confirm = await as(asha).post(`/api/expenses/${res.body.settlementId}/settlement`, { action: 'confirm' });
        expect(confirm.status).toBe(200);
        expect((await balancesOf(asha))[bala.id]).toBe(0);
        expect((await notificationsFor(bala)).some(m => m.includes('confirmed receiving your payment'))).toBe(true);
    });

    test('a rejected settlement never changes balances', async () => {
        const { body } = await as(bala).post(`/api/expenses/${groupId}/settle`, { toUserId: asha.id, amount: 100 });

        expect((await as(asha).post(`/api/expenses/${body.settlementId}/settlement`, { action: 'reject' })).status).toBe(200);

        expect((await balancesOf(asha))[bala.id]).toBe(-100);
        const stored = (await db.collection('expenses').doc(body.settlementId).get()).data();
        expect(stored.settlement_status).toBe('rejected');
    });

    test('the receiver recording "they paid me" counts immediately', async () => {
        const res = await as(asha).post(`/api/expenses/${groupId}/settle`, { fromUserId: chen.id, toUserId: asha.id, amount: 40 });

        expect(res.body.status).toBe('confirmed');
        expect((await balancesOf(asha))[chen.id]).toBe(-60);
    });

    test('only the receiver can confirm, and only once', async () => {
        const { body } = await as(bala).post(`/api/expenses/${groupId}/settle`, { toUserId: asha.id, amount: 100 });
        const url = `/api/expenses/${body.settlementId}/settlement`;

        expect((await as(bala).post(url, { action: 'confirm' })).status).toBe(403); // payer can't confirm own payment
        expect((await as(chen).post(url, { action: 'confirm' })).status).toBe(403); // bystander can't either
        expect((await as(asha).post(url, { action: 'confirm' })).status).toBe(200);
        expect((await as(asha).post(url, { action: 'confirm' })).status).toBe(400); // already confirmed
        expect((await as(asha).post(url, { action: 'reject' })).status).toBe(400);  // can't flip it afterwards
    });

    test('rejects unknown actions and non-settlement entries', async () => {
        const { body } = await as(bala).post(`/api/expenses/${groupId}/settle`, { toUserId: asha.id, amount: 100 });
        expect((await as(asha).post(`/api/expenses/${body.settlementId}/settlement`, { action: 'approve' })).status).toBe(400);

        const expenses = (await as(asha).get(`/api/expenses/${groupId}/all`)).body.expenses;
        const hotel = expenses.find(e => e.description === 'Hotel');
        expect((await as(bala).post(`/api/expenses/${hotel.id}/settlement`, { action: 'confirm' })).status).toBe(400);
    });

    test('the list shows settlement type and status', async () => {
        await as(bala).post(`/api/expenses/${groupId}/settle`, { toUserId: asha.id, amount: 100 });
        const expenses = (await as(asha).get(`/api/expenses/${groupId}/all`)).body.expenses;

        expect(expenses.find(e => e.description === 'Hotel')).toMatchObject({ type: 'expense', settlement_status: null });
        expect(expenses.find(e => e.type === 'settlement')).toMatchObject({ settlement_status: 'pending', to_user_id: asha.id });
    });

    test('pending payments are left out of the dashboard summary', async () => {
        await as(bala).post(`/api/expenses/${groupId}/settle`, { toUserId: asha.id, amount: 100 });
        const summary = (await as(asha).get('/api/expenses/summary')).body;
        expect(summary.youAreOwed.find(p => p.userId === bala.id).amount).toBe(100);
    });
});

describe('soft delete and audit log', () => {
    test('deleting keeps the document but removes it from the list and balances', async () => {
        const expenses = (await as(asha).get(`/api/expenses/${groupId}/all`)).body.expenses;
        const hotelId = expenses[0].id;

        expect((await as(asha).delete(`/api/expenses/${hotelId}`)).status).toBe(200);

        const stored = (await db.collection('expenses').doc(hotelId).get()).data();
        expect(stored.deleted_at).toBeTruthy();
        expect(stored.deleted_by).toBe(asha.id);
        expect((await as(asha).get(`/api/expenses/${groupId}/all`)).body.expenses).toHaveLength(0);
        expect((await balancesOf(asha))[bala.id]).toBeUndefined();

        // a deleted entry can't be edited or deleted again
        expect((await as(asha).put(`/api/expenses/${hotelId}`, { description: 'x' })).status).toBe(404);
        expect((await as(asha).delete(`/api/expenses/${hotelId}`)).status).toBe(404);
    });

    test('history records who created, edited and deleted an entry, with what changed', async () => {
        const [hotel] = (await as(asha).get(`/api/expenses/${groupId}/all`)).body.expenses;

        await as(asha).put(`/api/expenses/${hotel.id}`, { description: 'Hotel Goa' });
        await as(asha).put(`/api/expenses/${hotel.id}`, { description: 'Hotel Goa' }); // no-op edit: not logged

        const history = (await as(bala).get(`/api/expenses/${hotel.id}/history`)).body.history;
        expect(history.map(h => h.action)).toEqual(['created', 'updated']);
        expect(history[1]).toMatchObject({
            actor_name: 'asha',
            changes: { description: { from: 'Hotel', to: 'Hotel Goa' } }
        });

        await as(asha).delete(`/api/expenses/${hotel.id}`);
        expect((await auditFor(hotel.id)).map(a => a.action).sort()).toEqual(['created', 'deleted', 'updated']);
    });

    test('settlement lifecycle is fully audited', async () => {
        const { body } = await as(bala).post(`/api/expenses/${groupId}/settle`, { toUserId: asha.id, amount: 100 });
        await as(asha).post(`/api/expenses/${body.settlementId}/settlement`, { action: 'confirm' });

        const actions = (await auditFor(body.settlementId)).map(a => `${a.action}:${a.actor_id}`).sort();
        expect(actions).toEqual([`settlement_confirmed:${asha.id}`, `settlement_recorded:${bala.id}`].sort());
    });

    test('marking wrong is audited', async () => {
        const [hotel] = (await as(asha).get(`/api/expenses/${groupId}/all`)).body.expenses;
        await as(asha).post(`/api/expenses/${hotel.id}/mark-wrong`, { isWrong: true });
        expect((await auditFor(hotel.id)).map(a => a.action)).toContain('marked_wrong');
    });

    test('non-members cannot read an entry history', async () => {
        const outsider = await createUser({ username: 'zed', email: 'zed@test.com' });
        const [hotel] = (await as(asha).get(`/api/expenses/${groupId}/all`)).body.expenses;
        expect((await as(outsider).get(`/api/expenses/${hotel.id}/history`)).status).toBe(403);
    });
});
