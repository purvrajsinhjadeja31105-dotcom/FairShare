const express = require('express');
const cors = require('cors');
const http = require('http');
const socketService = require('./services/socketService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize Socket.io
socketService.init(server);

// Standard middleware
app.use(express.json());

// Enhanced CORS for production
const allowedOrigins = [
    process.env.FRONTEND_URL,
    'https://split-wise-dusky.vercel.app',
    'https://fair-share-sage.vercel.app',
    'http://localhost:5173', // Vite default
    'http://localhost:3000'
].map(url => url?.replace(/\/$/, '')).filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);

        const normalizedOrigin = origin.replace(/\/$/, '');
        if (allowedOrigins.includes(normalizedOrigin) || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            console.error(`[CORS Blocked] Origin "${origin}" is not in allowedOrigins:`, allowedOrigins);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Request logger for debugging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'FairShare Clone API is running.' });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/users', require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', async (req, res, next) => {
    try {
        const db = require('./config/db');
        // Simple firestore health check
        await db.collection('health').limit(1).get();
        res.json({ status: 'ok', message: 'backend and database are running.' });
    } catch (err) {
        next(err); // Delegate database errors to errorHandler
    }
});

// Centralized error handling middleware
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

