const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

const isProduction = process.env.NODE_ENV === 'production';
const MINUTE = 60 * 1000;

const limiter = ({ windowMs, limit, message, ...rest }) => rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Same { error } shape as every other API error, so the frontend shows the message as-is
    message: { error: message },
    ...rest
});

/**
 * Failed logins per IP + email. Successful logins don't count, so a user who
 * mistypes once isn't punished; a password-guessing script is stopped after a few tries.
 */
const createLoginLimiter = (limit = isProduction ? 10 : 100) => limiter({
    windowMs: 15 * MINUTE,
    limit,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.email || '').toLowerCase()}`,
    message: 'Too many failed login attempts. Please wait 15 minutes and try again.'
});

/** Routes that send an email (register, resend verification, forgot password), per IP. */
const createEmailLimiter = (limit = isProduction ? 5 : 100) => limiter({
    windowMs: 60 * MINUTE,
    limit,
    message: 'Too many requests. Please wait an hour before trying again.'
});

/** Broad safety net for the whole API, per IP. */
const createApiLimiter = (limit = isProduction ? 600 : 10000) => limiter({
    windowMs: 15 * MINUTE,
    limit,
    message: 'Too many requests. Please slow down and try again shortly.'
});

module.exports = {
    createLoginLimiter,
    createEmailLimiter,
    createApiLimiter,
    loginLimiter: createLoginLimiter(),
    emailLimiter: createEmailLimiter(),
    apiLimiter: createApiLimiter()
};
