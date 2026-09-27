// Public addresses of the two apps, used in email links and CORS. Set them per deployment:
// FRONTEND_URL is the Vercel site; BACKEND_URL is this API (Render also provides RENDER_EXTERNAL_URL).
const clean = (url) => url?.trim().replace(/\/$/, '') || null;

const frontendUrl = () => clean(process.env.FRONTEND_URL) || 'http://localhost:5173';
const backendUrl = () => clean(process.env.BACKEND_URL) || clean(process.env.RENDER_EXTERNAL_URL) || 'http://localhost:5000';

module.exports = { frontendUrl, backendUrl };
