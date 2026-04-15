// Use the provided env variable or default to the Render backend URL for production
const API_URL = import.meta.env.VITE_API_BASE_URL || 'https://splitwise-lcur.onrender.com/api';

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

    const response = await fetch(`${API_URL}${endpoint}`, config);
    
    // Check Content-Type to avoid JSON parsing errors for HTML
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `Error ${response.status}: Something went wrong`);
        }
        return data;
    } else {
        // Handle non-JSON response (usually HTML 404/500)
        const text = await response.text();
        console.error("Non-JSON API response at", endpoint, ":", text.substring(0, 200));
        throw new Error(`Server error (${response.status}): Expected JSON but received ${contentType || 'text'}. Check console for details.`);
    }
};
