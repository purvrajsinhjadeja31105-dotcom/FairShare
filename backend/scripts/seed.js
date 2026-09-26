/**
 * Seeds the LOCAL Firestore emulator with demo users, a group and some expenses.
 * Refuses to run unless FIRESTORE_EMULATOR_HOST is set, so it can never touch production.
 *
 *   npm run seed
 */
require('dotenv').config({ quiet: true });

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error('Refusing to seed: FIRESTORE_EMULATOR_HOST is not set. This script only runs against the local emulator.');
    process.exit(1);
}

const bcrypt = require('bcrypt');
const { FieldValue } = require('firebase-admin/firestore');
const db = require('../config/db');
const { toPaise, fromPaise, splitEvenly } = require('../utils/money');

const PASSWORD = 'password123';
const COLLECTIONS = ['users', 'groups', 'expenses', 'notifications', 'polls', 'votes'];

const clearCollection = async (name) => {
    const snapshot = await db.collection(name).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};

const addExpense = (groupId, paidBy, amount, description, participants) => {
    const shares = splitEvenly(toPaise(amount), participants.length);
    const splits = participants.map((userId, i) => ({ userId, amount_owed: fromPaise(shares[i]) }));
    return db.collection('expenses').add({
        group_id: groupId,
        paid_by: paidBy,
        amount,
        description,
        is_wrong: false,
        splits,
        splits_userIds: Array.from(new Set([paidBy, ...participants])),
        hidden_by: [],
        created_at: FieldValue.serverTimestamp()
    });
};

async function seed() {
    await Promise.all(COLLECTIONS.map(clearCollection));

    const password_hash = await bcrypt.hash(PASSWORD, 10);
    const people = [
        { username: 'asha', email: 'asha@example.com', upi_id: 'asha@okbank' },
        { username: 'bala', email: 'bala@example.com' },
        { username: 'chen', email: 'chen@example.com' }
    ];

    const [asha, bala, chen] = await Promise.all(people.map(async (p) => {
        const ref = await db.collection('users').add({
            ...p,
            password_hash,
            is_verified: true,
            verification_token: null,
            created_at: new Date()
        });
        return ref.id;
    }));

    const group = await db.collection('groups').add({
        name: 'Goa Trip',
        is_personal: false,
        created_by: asha,
        admin_id: asha,
        members: [asha, bala, chen],
        created_at: FieldValue.serverTimestamp()
    });

    await addExpense(group.id, asha, 4500, 'Hotel booking', [asha, bala, chen]);
    await addExpense(group.id, bala, 1000, 'Seafood dinner', [asha, bala, chen]);
    await addExpense(group.id, chen, 750, 'Airport taxi', [asha, chen]);

    console.log('Seeded local emulator:');
    people.forEach(p => console.log(`  ${p.email.padEnd(20)} password: ${PASSWORD}`));
    console.log('  Group "Goa Trip" with 3 expenses (asha is admin)');
}

seed()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Seeding failed:', err);
        process.exit(1);
    });
