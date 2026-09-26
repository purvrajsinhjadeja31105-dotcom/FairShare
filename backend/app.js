const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('./config/env'); // fail fast on missing required configuration
const db = require('./config/db');
const { corsOrigin } = require('./config/cors');
const { apiLimiter } = require('./middleware/rateLimiters');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Render (and most hosts) sit behind one reverse proxy; needed so req.ip is the real client IP for rate limiting
app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '100kb' }));

app.use(cors({
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));

if (process.env.NODE_ENV !== 'test') {
    // Request logger for debugging
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
        next();
    });
}

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'FairShare Clone API is running.' });
});

app.use('/api', apiLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', async (req, res, next) => {
    try {
        // Simple firestore health check
        await db.collection('health').limit(1).get();
        res.json({ status: 'ok', message: 'backend and database are running.' });
    } catch (err) {
        next(err); // Delegate database errors to errorHandler
    }
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
