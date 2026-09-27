// Browser origins allowed to call the API and open Socket.io connections.
// In production only the deployed frontend (FRONTEND_URL) may call the API; in development any origin can.
const { frontendUrl } = require('./urls');
const allowedOrigins = [frontendUrl()];

const isAllowedOrigin = (origin) => {
    // Requests without an Origin header (curl, mobile apps, server-to-server) aren't subject to CORS
    if (!origin) return true;
    if (process.env.NODE_ENV !== 'production') return true;
    return allowedOrigins.includes(origin.replace(/\/$/, ''));
};

// Shape expected by both the `cors` package and Socket.io's `cors.origin` option
const corsOrigin = (origin, callback) => {
    if (isAllowedOrigin(origin)) return callback(null, true);
    console.error(`[CORS Blocked] Origin "${origin}" is not in allowedOrigins:`, allowedOrigins);
    callback(new Error('Not allowed by CORS'));
};

module.exports = { allowedOrigins, isAllowedOrigin, corsOrigin };
