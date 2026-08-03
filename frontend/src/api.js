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
    
    // Log for debugging in production console
    if (import.meta.env.DEV) {
        console.log(`[API] ${method} ${fullUrl}`);
    }

    try {
        const response = await fetch(fullUrl, config);
        
        // Check Content-Type to avoid JSON parsing errors for HTML
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            const data = await response.json();
            if (!response.ok) {
                let errMsg = data.error || data.message || `Error ${response.status}: Something went wrong`;
                if (data.details && Array.isArray(data.details) && data.details.length > 0) {
                    errMsg = data.details.map(d => d.message || d.field).join('. ');
                }
                throw new Error(errMsg);
            }
            return data;
        } else {
            // Handle non-JSON response (usually HTML 404/500)
            const text = await response.text();
            console.error("Non-JSON API response at", endpoint, ":", text.substring(0, 200));
            throw new Error(`Server error (${response.status}): Expected JSON but received ${contentType || 'text'}. Check console for details.`);
        }
    } catch (error) {
        if (error instanceof TypeError) {
            console.error("Fetch error - possible CORS issue or incorrect URL:", fullUrl, error);
            throw new Error(`Connection failed. Please check if the API URL is correct and the server is running. (${fullUrl})`);
        }
        throw error;
    }
};
