const db = require('../config/db');

/**
 * A valid JWT isn't enough: the account it names must still exist (it may have been deleted,
 * or a local dev database may have been reset). Results are cached briefly so this costs
 * at most one read per user per minute.
 */
const TTL_MS = 60 * 1000;
const cache = new Map(); // userId -> { exists, expires }

const accountExists = async (userId) => {
    const hit = cache.get(userId);
    if (hit && hit.expires > Date.now()) return hit.exists;

    const exists = Boolean(userId) && (await db.collection('users').doc(userId).get()).exists;
    cache.set(userId, { exists, expires: Date.now() + TTL_MS });
    return exists;
};

const SESSION_GONE = 'Your session is no longer valid. Please log in again.';

module.exports = { accountExists, SESSION_GONE, _clearAccountCache: () => cache.clear() };
