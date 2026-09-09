import axios from 'axios';

// VITE_API_URL should be the API host (no trailing slash, no /api path).
// Example: https://mach-backend-695y.onrender.com
const defaultHost = import.meta.env.DEV ? 'http://localhost:5005' : 'https://mach-backend-695y.onrender.com';
const host = import.meta.env.VITE_API_URL || defaultHost;
const apiBaseUrl = String(host).replace(/\/$/, '') + '/api';

const api = axios.create({
    baseURL: apiBaseUrl,
    timeout: 15000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const userInfo = sessionStorage.getItem('userInfo');
        if (userInfo) {
            try {
                const { token } = JSON.parse(userInfo);
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (e) {
                sessionStorage.removeItem('userInfo');
                localStorage.removeItem('userInfo');
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// In-memory cache for GET requests to make page switching instant (0ms)
const getCache = new Map();
const CACHE_TTL_MS = 45 * 1000; // 45 seconds

export const clearApiCache = () => {
    getCache.clear();
};

const originalGet = api.get.bind(api);
api.get = async function (url, config = {}) {
    if (config?.skipCache) {
        return originalGet(url, config);
    }
    const cacheKey = `${url}?${JSON.stringify(config?.params || '')}`;
    const cached = getCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp < CACHE_TTL_MS)) {
        return Promise.resolve({
            ...cached.response,
            data: JSON.parse(JSON.stringify(cached.response.data))
        });
    }

    const response = await originalGet(url, config);
    if (response && response.status >= 200 && response.status < 300) {
        getCache.set(cacheKey, {
            timestamp: Date.now(),
            response
        });
    }
    return response;
};

// Response interceptor to handle 401 and auto-invalidate cache on mutations
api.interceptors.response.use(
    (response) => {
        const method = (response?.config?.method || 'get').toLowerCase();
        if (method !== 'get') {
            // Any mutation (add student, pay fees, update class) clears cache so views are always fresh
            getCache.clear();
        }
        return response;
    },
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error('Unauthorized access:', error.response.data);
            const msg = error.response.data?.message || '';
            if (
                msg.includes('user not found') ||
                msg.includes('User not found') ||
                msg.includes('token failed') ||
                msg.includes('no token') ||
                msg.includes('Not authorized')
            ) {
                sessionStorage.removeItem('userInfo');
                localStorage.removeItem('userInfo');
                getCache.clear();
                window.dispatchEvent(new Event('auth:unauthorized'));
            }
        }
        return Promise.reject(error);
    }
);

export default api;

