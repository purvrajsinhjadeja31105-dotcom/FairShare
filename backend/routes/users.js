const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMid = require('../middleware/authMiddleware');

router.use(authMid);

router.get('/search', async (req, res, next) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ users: [] });

        // Firestore doesn't support generic 'LIKE' queries.
        // We'll fetch a limited number of users and filter in-memory,
        // or do a prefix search on username. For a simple clone, pulling all and filtering is okay if users are few,
        // but let's try a prefix search on username.
        
        // Note: Firestore requires multiple inequality queries to be on the same field.
        const snapshot = await db.collection('users')
            .where('username', '>=', q)
            .where('username', '<=', q + '\uf8ff')
            .limit(10)
            .get();

        let users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({ id: doc.id, username: data.username, email: data.email });
        });

        // If no results by username, maybe try email
        if (users.length === 0) {
            const emailSnap = await db.collection('users')
                .where('email', '>=', q)
                .where('email', '<=', q + '\uf8ff')
                .limit(10)
                .get();
            
            emailSnap.forEach(doc => {
                const data = doc.data();
                users.push({ id: doc.id, username: data.username, email: data.email });
            });
        }

        res.json({ users });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
