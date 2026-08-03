// Use the provided env variable or default to the Render backend URL for production
const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://fairshare-backend-9bgf.onrender.com/api';

const authHeader = () => {
    const token = localStorage.getItem('fairshare_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const apiCall = async (endpoint, method = 'GET', body = null) => {
    const headers = {
        'Content-Type': 'application/json',
        ...authHeader()
    };

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const fullUrl = `${API_URL}${endpoint}`;
    
    console.log(`[API Request] ${method} ${fullUrl}`, body ? body : '');

    try {
        const response = await fetch(fullUrl, config);
        console.log(`[API Response] ${method} ${fullUrl} -> Status ${response.status}`);
        
        // Check Content-Type to avoid JSON parsing errors for HTML
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (!response.ok) {
                let errMsg = data.error || data.message || `Error ${response.status}: Something went wrong`;
                if (data.details && Array.isArray(data.details) && data.details.length > 0) {
                    errMsg = data.details.map(d => d.message || d.field).join('. ');
                }
                const err = new Error(errMsg);
                err.status = response.status;
                err.details = data.details;
                console.error(`[API Fail] ${method} ${fullUrl}:`, errMsg, data);
                throw err;
            }
            return data;
        } else {
            // Handle non-JSON response (usually HTML 404/500)
            const text = await response.text();
            console.error("[API Non-JSON Response] at", endpoint, ":", text.substring(0, 200));
            const err = new Error(`Server error (${response.status}): Received non-JSON response (${contentType || 'text'}).`);
            err.status = response.status;
            throw err;
        }
    } catch (error) {
        if (error instanceof TypeError) {
            console.error("[API Network Error] Fetch error / CORS / Server down at:", fullUrl, error);
            const err = new Error(`Connection failed. Server may be sleeping or unreachable (${fullUrl}).`);
            err.status = 0;
            throw err;
        }
        throw error;
    }
};
