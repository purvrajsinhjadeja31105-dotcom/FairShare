const { app, db, request, clearDb, createUser, PASSWORD } = require('./helpers');
const emailService = require('../../services/emailService');
const { hashToken } = require('../../utils/tokens');

const findUser = async (email) => (await db.collection('users').where('email', '==', email).get()).docs[0];

beforeEach(async () => {
    await clearDb();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('registration and email verification', () => {
    const register = (body = {}) => request(app).post('/api/auth/register')
        .send({ username: 'Asha', email: 'asha@test.com', password: 'secret123', ...body });

    test('stores only a hash of the verification token and emails the raw token', async () => {
        const sendSpy = jest.spyOn(emailService, 'sendVerificationEmail');

        const res = await register();

        expect(res.status).toBe(201);
        expect(res.body.emailSent).toBe(true);
        const rawToken = sendSpy.mock.calls[0][2];
        const stored = (await findUser('asha@test.com')).data();
        expect(stored.verification_token).toBe(hashToken(rawToken));
        expect(stored.verification_token).not.toBe(rawToken);
        expect(stored.password_hash).not.toBe('secret123');
    });

    test('full flow: blocked before verifying, allowed after', async () => {
        const sendSpy = jest.spyOn(emailService, 'sendVerificationEmail');
        await register();
        const rawToken = sendSpy.mock.calls[0][2];

        const before = await request(app).post('/api/auth/login').send({ email: 'asha@test.com', password: 'secret123' });
        expect(before.status).toBe(403);

        const verify = await request(app).get(`/api/auth/verify?token=${rawToken}`);
        expect(verify.status).toBe(200);
        expect(verify.text).toContain('Email Verified Successfully');

        const after = await request(app).post('/api/auth/login').send({ email: 'asha@test.com', password: 'secret123' });
        expect(after.status).toBe(200);
        expect(after.body.token).toBeTruthy();

        // links are single-use
        expect((await request(app).get(`/api/auth/verify?token=${rawToken}`)).status).toBe(400);
    });

    test('rejects duplicate emails', async () => {
        await register();
        const res = await register({ username: 'Other' });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/already exists/);
    });

    test('returns readable 400 validation errors', async () => {
        const res = await register({ email: 'not-an-email', password: '1' });
        expect(res.status).toBe(400);
        expect(res.body.details.map(d => d.field).sort()).toEqual(['email', 'password']);
    });

    test('expired verification links are rejected', async () => {
        const sendSpy = jest.spyOn(emailService, 'sendVerificationEmail');
        await register();
        const doc = await findUser('asha@test.com');
        await doc.ref.update({ verification_token_expiry: new Date(Date.now() - 1000).toISOString() });

        const res = await request(app).get(`/api/auth/verify?token=${sendSpy.mock.calls[0][2]}`);
        expect(res.status).toBe(400);
    });

    test('links emailed before token hashing (raw token in DB) still work', async () => {
        await createUser({ username: 'Old', email: 'old@test.com', verified: false, verification_token: 'legacy-raw-token' });
        const res = await request(app).get('/api/auth/verify?token=legacy-raw-token');
        expect(res.status).toBe(200);
        expect((await findUser('old@test.com')).data().is_verified).toBe(true);
    });

    test('resend issues a new token and invalidates the old link', async () => {
        const sendSpy = jest.spyOn(emailService, 'sendVerificationEmail');
        await register();
        const firstToken = sendSpy.mock.calls[0][2];

        const resend = await request(app).post('/api/auth/resend-verification').send({ email: 'asha@test.com' });
        expect(resend.status).toBe(200);
        const secondToken = sendSpy.mock.calls[1][2];

        expect(secondToken).not.toBe(firstToken);
        expect((await request(app).get(`/api/auth/verify?token=${firstToken}`)).status).toBe(400);
        expect((await request(app).get(`/api/auth/verify?token=${secondToken}`)).status).toBe(200);
    });
});

describe('login', () => {
    test('wrong password on an unverified account says "invalid credentials", not "verify your email"', async () => {
        await createUser({ username: 'U', email: 'u@test.com', verified: false });
        const res = await request(app).post('/api/auth/login').send({ email: 'u@test.com', password: 'wrong' });
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Invalid credentials');
    });

    test('unknown email and wrong password look the same', async () => {
        await createUser({ username: 'U', email: 'u@test.com' });
        const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: PASSWORD });
        const wrong = await request(app).post('/api/auth/login').send({ email: 'u@test.com', password: 'wrong' });
        expect(unknown.status).toBe(401);
        expect(wrong.body).toEqual(unknown.body);
    });
});

describe('password reset', () => {
    test('reset link changes the password once and stores only a hash', async () => {
        await createUser({ username: 'U', email: 'u@test.com' });
        const sendSpy = jest.spyOn(emailService, 'sendPasswordResetEmail');

        expect((await request(app).post('/api/auth/forgot-password').send({ email: 'u@test.com' })).status).toBe(200);
        const rawToken = sendSpy.mock.calls[0][2];
        expect((await findUser('u@test.com')).data().reset_token).toBe(hashToken(rawToken));

        const reset = await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'brandnew1' });
        expect(reset.status).toBe(200);

        expect((await request(app).post('/api/auth/login').send({ email: 'u@test.com', password: 'brandnew1' })).status).toBe(200);
        expect((await request(app).post('/api/auth/login').send({ email: 'u@test.com', password: PASSWORD })).status).toBe(401);
        expect((await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'again1234' })).status).toBe(400);
    });

    test('unknown emails get the same response (no account enumeration)', async () => {
        const res = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@test.com' });
        expect(res.status).toBe(200);
        expect(res.body.message).toMatch(/If that email is registered/);
    });
});

describe('protected routes', () => {
    test('reject requests without a valid token', async () => {
        expect((await request(app).get('/api/groups')).status).toBe(403);
        expect((await request(app).get('/api/groups').set('Authorization', 'Bearer forged')).status).toBe(401);
    });

    test('malformed JSON gets a 400, not a 500', async () => {
        const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/not valid JSON/);
    });
});
