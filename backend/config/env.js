require('dotenv').config({ quiet: true });

// Fail fast: signing tokens with a guessable fallback secret would let anyone forge logins.
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in backend/.env or your hosting provider.');
}

// Production must never point at the local emulator (all data would vanish on restart),
// and CORS and email links need the real site addresses.
if (process.env.NODE_ENV === 'production') {
    if (process.env.FIRESTORE_EMULATOR_HOST) {
        throw new Error('FIRESTORE_EMULATOR_HOST is set in production. Remove it so the real database is used.');
    }
    if (process.env.JWT_SECRET.length < 32) {
        throw new Error('JWT_SECRET is too short for production. Use at least 32 random characters.');
    }
    if (!process.env.FRONTEND_URL) {
        throw new Error('FRONTEND_URL is required in production (the Vercel site address). It is used for CORS and email links.');
    }
    if (!process.env.BACKEND_URL && !process.env.RENDER_EXTERNAL_URL) {
        throw new Error('BACKEND_URL is required in production (this API\'s public address). It is used in verification emails.');
    }
}

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET
};
