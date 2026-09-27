const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { accountExists, SESSION_GONE } = require('../services/accountCheck');

module.exports = async (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    let decoded;
    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        // A correctly signed token for an account that no longer exists must not act as anyone
        if (!(await accountExists(decoded.userId))) {
            return res.status(401).json({ error: SESSION_GONE });
        }
    } catch (err) {
        return next(err);
    }

    req.user = decoded;
    next();
};
