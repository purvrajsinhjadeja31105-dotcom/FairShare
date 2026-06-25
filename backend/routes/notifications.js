const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMid = require('../middleware/authMiddleware');

router.use(authMid);

router.get('/', async (req, res, next) => {
    try {
        const snapshot = await db.collection('notifications')
            .where('user_id', '==', req.user.userId)
            .get();
            
        let notifs = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            notifs.push({ 
                id: doc.id, 
                message: data.message, 
                is_read: data.is_read, 
                // Firestore timestamps might need converting to JS dates or keeping as is depending on frontend
                created_at: data.created_at ? data.created_at.toDate() : new Date() 
            });
        });

        // Sort in-memory descending by created_at
        notifs.sort((a, b) => {
            const timeA = a.created_at ? a.created_at.getTime() : 0;
            const timeB = b.created_at ? b.created_at.getTime() : 0;
            return timeB - timeA;
        });

        // Limit to top 20
        const limitedNotifs = notifs.slice(0, 20);

        res.json({ notifications: limitedNotifs });
    } catch (err) {
        next(err);
    }
});

router.post('/read', async (req, res, next) => {
    try {
        const snapshot = await db.collection('notifications')
            .where('user_id', '==', req.user.userId)
            .where('is_read', '==', false)
            .get();
            
        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.update(doc.ref, { is_read: true });
        });
        await batch.commit();

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
