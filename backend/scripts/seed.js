/**
 * Resets the LOCAL Firestore emulator to three demo users and nothing else (no groups or expenses),
 * so you can create groups yourself and watch what happens.
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
const db = require('../config/db');

const PASSWORD = 'password123';
const COLLECTIONS = ['users', 'groups', 'expenses', 'notifications', 'audit_logs'];

const clearCollection = async (name) => {
    const snapshot = await db.collection(name).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};

async function seed() {
    await Promise.all(COLLECTIONS.map(clearCollection));

    const password_hash = await bcrypt.hash(PASSWORD, 10);
    const people = [
        { username: 'asha', email: 'asha@example.com', upi_id: 'asha@okbank' },
        { username: 'bala', email: 'bala@example.com' },
        { username: 'chen', email: 'chen@example.com' }
    ];

    // Fixed IDs, so a browser that stays logged in as a demo user keeps working after a restart re-seeds
    await Promise.all(people.map(p => db.collection('users').doc(`demo-${p.username}`).set({
        ...p,
        password_hash,
        is_verified: true,
        verification_token: null,
        created_at: new Date()
    })));

    console.log('Seeded local emulator with demo users (no groups):');
    people.forEach(p => console.log(`  ${p.email.padEnd(20)} password: ${PASSWORD}`));
}

seed()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Seeding failed:', err);
        process.exit(1);
    });
