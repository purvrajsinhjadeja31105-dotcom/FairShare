require('dotenv').config({ quiet: true });

// Fail fast: signing tokens with a guessable fallback secret would let anyone forge logins.
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Set it in backend/.env or your hosting provider.');
}

module.exports = {
    JWT_SECRET: process.env.JWT_SECRET
};
