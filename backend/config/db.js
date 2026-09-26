const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config({ quiet: true });

// Local development: firebase-admin talks to the emulator automatically when
// FIRESTORE_EMULATOR_HOST is set, so no service account (and no production data) is involved.
if (getApps().length === 0 && process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID || 'demo-fairshare' });
    console.log(`[DB] Using LOCAL Firestore emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
} else if (getApps().length === 0) {
    if (process.env.NODE_ENV !== 'production') {
        console.warn('[DB] WARNING: FIRESTORE_EMULATOR_HOST is not set — this process is using the PRODUCTION database.');
    }
    try {
        let serviceAccount;
        const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || 
                       process.env.FIREBASE_SERVICE_ACCOUNT || 
                       process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

        if (rawKey) {
            try {
                serviceAccount = typeof rawKey === 'object' ? rawKey : JSON.parse(rawKey);
            } catch (e) {
                try {
                    serviceAccount = JSON.parse(Buffer.from(rawKey, 'base64').toString('utf8'));
                } catch (b64Err) {
                    console.error("[DB] Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable:", e.message);
                }
            }
        }

        if (!serviceAccount) {
            // Fallback to the local JSON file
            try {
                serviceAccount = require('../../fairshare-app-c1a76-firebase-adminsdk-fbsvc-8a15025dee.json');
            } catch (e) {
                console.warn("[DB] Could not load local service account file:", e.message);
            }
        }

        if (serviceAccount) {
            initializeApp({
                credential: cert(serviceAccount)
            });
            console.log("[DB] Firebase initialized successfully with Service Account.");
        } else {
            console.error("[DB] CRITICAL: No Firebase Service Account Key found! Database operations will fail on cloud environment.");
            initializeApp();
        }
    } catch (error) {
        console.error("[DB] Firebase initialization error:", error);
    }
}

const db = getFirestore();

// Export firestore instance
module.exports = db;
