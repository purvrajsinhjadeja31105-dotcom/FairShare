const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

// Initialize Firebase Admin SDK
if (getApps().length === 0) {
    try {
        let serviceAccount;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        } else {
            // Fallback to the local JSON file
            try {
                serviceAccount = require('../../fairshare-app-c1a76-firebase-adminsdk-fbsvc-8a15025dee.json');
            } catch (e) {
                console.warn("Could not load local service account file:", e.message);
            }
        }

        if (serviceAccount) {
            initializeApp({
                credential: cert(serviceAccount)
            });
            console.log("Firebase initialized successfully with Service Account.");
        } else {
            // Fallback to application default credentials if available
            initializeApp();
            console.warn("Firebase initialized with Application Default Credentials.");
        }
    } catch (error) {
        console.error("Firebase initialization error:", error);
    }
}

const db = getFirestore();

// Export firestore instance
module.exports = db;
