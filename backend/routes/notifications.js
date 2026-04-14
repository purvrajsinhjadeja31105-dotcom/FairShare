const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMid = require('../middleware/authMiddleware');

router.use(authMid);

router.get('/', async (req, res) => {
    try {
        const [notifs] = await db.query(
            'SELECT id, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [req.user.userId]
        );
        res.json({ notifications: notifs });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/read', async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.userId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
