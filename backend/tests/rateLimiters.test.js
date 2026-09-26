const express = require('express');
const request = require('supertest');
const { createLoginLimiter, createEmailLimiter } = require('../middleware/rateLimiters');

const appWith = (limiter, status = 200) => {
    const app = express();
    app.use(express.json());
    app.post('/', limiter, (req, res) => res.status(status).json({ ok: true }));
    return app;
};

describe('login limiter', () => {
    test('blocks after too many failed attempts for the same email', async () => {
        const app = appWith(createLoginLimiter(3), 401);
        for (let i = 0; i < 3; i++) {
            expect((await request(app).post('/').send({ email: 'a@test.com' })).status).toBe(401);
        }
        const blocked = await request(app).post('/').send({ email: 'a@test.com' });
        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toMatch(/Too many failed login attempts/);
    });

    test('counts each email separately and treats email case-insensitively', async () => {
        const app = appWith(createLoginLimiter(1), 401);
        await request(app).post('/').send({ email: 'a@test.com' });
        expect((await request(app).post('/').send({ email: 'A@TEST.COM' })).status).toBe(429);
        expect((await request(app).post('/').send({ email: 'b@test.com' })).status).toBe(401);
    });

    test('successful logins do not count toward the limit', async () => {
        const app = appWith(createLoginLimiter(2), 200);
        for (let i = 0; i < 5; i++) {
            expect((await request(app).post('/').send({ email: 'a@test.com' })).status).toBe(200);
        }
    });
});

describe('email limiter', () => {
    test('caps email-sending requests per IP', async () => {
        const app = appWith(createEmailLimiter(2));
        expect((await request(app).post('/')).status).toBe(200);
        expect((await request(app).post('/')).status).toBe(200);
        expect((await request(app).post('/')).status).toBe(429);
    });
});
