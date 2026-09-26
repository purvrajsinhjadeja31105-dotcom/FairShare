/**
 * Runs the API tests against the Firestore emulator.
 * Reuses the emulator if `npm run dev` already has one running (tests use their own
 * `demo-fairshare-test` project, so dev data is untouched); otherwise starts a temporary one.
 */
const net = require('net');
const { spawn } = require('child_process');

const JEST = 'npx jest --config jest.api.config.js';

const isPortOpen = (port, host = '127.0.0.1') => new Promise(resolve => {
    const socket = net.connect(port, host);
    socket.once('connect', () => { socket.end(); resolve(true); });
    socket.once('error', () => resolve(false));
});

const run = (command) => {
    const child = spawn(command, { stdio: 'inherit', shell: true });
    child.on('exit', code => process.exit(code ?? 1));
};

(async () => {
    if (await isPortOpen(8080)) {
        console.log('Using the running Firestore emulator on port 8080 (test project: demo-fairshare-test)');
        run(JEST);
    } else {
        console.log('Starting a temporary Firestore emulator for the API tests...');
        run(`npx firebase emulators:exec --only firestore --project demo-fairshare-test "${JEST}"`);
    }
})();
