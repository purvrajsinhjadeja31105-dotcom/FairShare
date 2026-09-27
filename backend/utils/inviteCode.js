const crypto = require('crypto');

// Invite codes go in shareable links (e.g. /join/k7Qm2xPa9TzR), so they use URL-safe characters
// and avoid look-alikes (0/O, 1/l/I). 12 chars from 56 symbols is ~70 bits: unguessable.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

const createInviteCode = (length = 12) => {
    const bytes = crypto.randomBytes(length);
    return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('');
};

const isValidInviteCode = (code) => typeof code === 'string' && /^[A-HJ-NP-Za-km-np-z2-9]{12}$/.test(code);

module.exports = { createInviteCode, isValidInviteCode };
