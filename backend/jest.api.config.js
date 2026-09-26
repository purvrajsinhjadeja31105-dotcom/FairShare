// API tests: real Express app + Firestore emulator. Run with `npm run test:api`.
module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/api/**/*.test.js'],
    setupFiles: ['<rootDir>/tests/api/env.js'],
    maxWorkers: 1, // test files share one emulator project, so they run one at a time
    testTimeout: 20000
};
