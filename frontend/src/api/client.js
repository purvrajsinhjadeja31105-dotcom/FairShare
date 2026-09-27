// Thin fetch wrapper: adds the auth header, parses JSON, and turns API errors into readable Error objects.

// "/api" in development (the Vite proxy); the Render API address in production (checked in vite.config.js)
export const API_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export const TOKEN_KEY = 'fairshare_token';

export class ApiError extends Error {
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const readableMessage = (data, status) => {
    // Validation errors: show the field messages ("Amount must be greater than 0")
    if (Array.isArray(data?.details) && data.details.length > 0) {
        return data.details.map(d => d.message || d.field).join('. ');
    }
    return data?.error || data?.message || `Something went wrong (${status})`;
};

export const request = async (endpoint, { method = 'GET', body } = {}) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const headers = { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) };

    let response;
    try {
        response = await fetch(`${API_URL}${endpoint}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
        throw new ApiError('Could not reach the server. Check your connection; if the server was asleep it can take ~30 seconds to wake up.', 0);
    }

    const isJson = response.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
        // Expired, invalid or deleted-account session: let the app log out and send the user to login.
        // (Login itself also returns 401 for a wrong password, which is not a session problem.)
        if (response.status === 401 && token && !endpoint.startsWith('/auth/')) {
            window.dispatchEvent(new Event('auth_expired'));
        }
        throw new ApiError(readableMessage(data, response.status), response.status, data?.details);
    }
    return data;
};
