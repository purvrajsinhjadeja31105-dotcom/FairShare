const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { FieldValue } = require('firebase-admin/firestore');
const app = require('../../app');
const db = require('../../config/db');

const PASSWORD = 'password123';
let passwordHash;

/** Deletes every document in the test project (never the dev project). */
const clearDb = async () => {
    const { FIRESTORE_EMULATOR_HOST: host, FIREBASE_PROJECT_ID: project } = process.env;
    if (!project.endsWith('-test')) throw new Error(`Refusing to clear non-test project ${project}`);
    const res = await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to clear emulator: ${res.status}`);
};

const createUser = async ({ username, email, verified = true, ...extra }) => {
    passwordHash = passwordHash || await bcrypt.hash(PASSWORD, 4);
    const ref = await db.collection('users').add({
        username,
        email,
        password_hash: passwordHash,
        is_verified: verified,
        verification_token: null,
        created_at: new Date(),
        ...extra
    });
    return { id: ref.id, username, email, token: jwt.sign({ userId: ref.id, username }, process.env.JWT_SECRET) };
};

const createGroup = async ({ name = 'Trip', admin, members }) => {
    const ref = await db.collection('groups').add({
        name,
        is_personal: false,
        created_by: admin.id,
        admin_id: admin.id,
        members: members.map(m => m.id),
        created_at: FieldValue.serverTimestamp()
    });
    return ref.id;
};

/** supertest agent with the user's bearer token attached */
const as = (user) => ({
    get: (url) => request(app).get(url).set('Authorization', `Bearer ${user.token}`),
    post: (url, body) => request(app).post(url).set('Authorization', `Bearer ${user.token}`).send(body),
    put: (url, body) => request(app).put(url).set('Authorization', `Bearer ${user.token}`).send(body),
    delete: (url) => request(app).delete(url).set('Authorization', `Bearer ${user.token}`)
});

module.exports = { app, db, request, clearDb, createUser, createGroup, as, PASSWORD };
