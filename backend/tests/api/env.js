// Runs before each API test file, before the app is loaded (dotenv never overrides these).
// Tests use their own emulator project, so they never touch dev data (demo-fairshare) or production.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.FIREBASE_PROJECT_ID = 'demo-fairshare-test';
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.EMAIL_MODE = 'console';
