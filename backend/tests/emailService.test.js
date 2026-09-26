// The email service reads its configuration at load time, so each test loads a fresh copy.
const loadEmailService = (env) => {
    const saved = { ...process.env };
    Object.assign(process.env, { EMAIL_MODE: '', BREVO_API_KEY: '', EMAIL_FROM: '', ...env });
    let service;
    jest.isolateModules(() => { service = require('../services/emailService'); });
    process.env = saved;
    return service;
};

const okResponse = (body) => ({ ok: true, status: 201, json: async () => body });

beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn();
});

afterEach(() => jest.restoreAllMocks());

describe('brevo mode', () => {
    const env = { EMAIL_MODE: 'brevo', BREVO_API_KEY: 'test-key', EMAIL_FROM: 'sender@example.com', BACKEND_URL: 'http://localhost:5000' };

    test('sends the verification email through the Brevo API', async () => {
        fetch.mockResolvedValue(okResponse({ messageId: '<abc@brevo>' }));
        const { sendVerificationEmail } = loadEmailService(env);

        const info = await sendVerificationEmail('new@user.com', 'Asha', 'tok123');

        expect(info.messageId).toBe('<abc@brevo>');
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe('https://api.brevo.com/v3/smtp/email');
        expect(options.headers['api-key']).toBe('test-key');

        const payload = JSON.parse(options.body);
        expect(payload.sender).toEqual({ name: 'FairShare', email: 'sender@example.com' });
        expect(payload.to).toEqual([{ email: 'new@user.com' }]);
        expect(payload.htmlContent).toContain('http://localhost:5000/api/auth/verify?token=tok123');
    });

    test('throws with the Brevo error message when the API rejects the request', async () => {
        fetch.mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized', json: async () => ({ code: 'unauthorized', message: 'Key not found' }) });
        const { sendVerificationEmail } = loadEmailService(env);

        await expect(sendVerificationEmail('new@user.com', 'Asha', 'tok')).rejects.toThrow('Brevo API error 401: Key not found');
    });

    test('escapes HTML in usernames', async () => {
        fetch.mockResolvedValue(okResponse({ messageId: 'x' }));
        const { sendPasswordResetEmail } = loadEmailService(env);

        await sendPasswordResetEmail('new@user.com', '<script>x</script>', 'tok');

        const { htmlContent } = JSON.parse(fetch.mock.calls[0][1].body);
        expect(htmlContent).not.toContain('<script>');
        expect(htmlContent).toContain('&lt;script&gt;');
    });

    test('is the default mode when an API key is present', async () => {
        fetch.mockResolvedValue(okResponse({ messageId: 'x' }));
        const { sendVerificationEmail } = loadEmailService({ ...env, EMAIL_MODE: '' });

        await sendVerificationEmail('new@user.com', 'Asha', 'tok');
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});

describe('console mode', () => {
    test('prints the link and sends nothing', async () => {
        const { sendVerificationEmail } = loadEmailService({ EMAIL_MODE: 'console', BACKEND_URL: 'http://localhost:5000' });

        await sendVerificationEmail('new@user.com', 'Asha', 'tok123');

        expect(fetch).not.toHaveBeenCalled();
        expect(console.log.mock.calls.flat().join(' ')).toContain('verify?token=tok123');
    });
});
