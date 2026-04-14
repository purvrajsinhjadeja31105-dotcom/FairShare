const express = require('express');
const router = express.Router();
const db = require('../config/db');
const authMid = require('../middleware/authMiddleware');

router.use(authMid);

router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) return res.json({ users: [] });

        const [users] = await db.query(
            'SELECT id, username, email FROM users WHERE username LIKE ? OR email LIKE ? LIMIT 10', 
            [`%${q}%`, `%${q}%`]
        );
        res.json({ users });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
