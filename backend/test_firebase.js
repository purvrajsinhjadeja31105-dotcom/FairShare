const db = require('./config/db');

async function testFirebase() {
    console.log("Testing Firebase connection...");
    try {
        // Attempt to read the users collection (limit 1)
        const snapshot = await db.collection('users').limit(1).get();
        console.log("SUCCESS! Connected to Firebase Firestore.");
        console.log(`Found ${snapshot.size} users in the database.`);
    } catch (err) {
        console.error("FAILURE! Could not connect to Firebase Firestore.");
        console.error(err);
    }
}

testFirebase();
