const crypto = require('crypto');

/**
 * One-time tokens (email verification, password reset).
 * The raw token only ever goes into the emailed link; the database stores its SHA-256 hash,
 * so someone who can read the database still can't use the tokens.
 */
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const createToken = () => {
    const token = crypto.randomBytes(32).toString('hex');
    return { token, hash: hashToken(token) };
};

const HOUR = 60 * 60 * 1000;
const expiresIn = (ms) => new Date(Date.now() + ms).toISOString();
const isExpired = (isoDate) => Boolean(isoDate) && new Date() > new Date(isoDate);

module.exports = { hashToken, createToken, expiresIn, isExpired, HOUR };
