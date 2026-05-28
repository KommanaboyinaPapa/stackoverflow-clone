import axios from 'axios';

const isProd = process.env.NODE_ENV === 'production';
const envApiUrl = process.env.REACT_APP_API_URL;

// Production deployments must set REACT_APP_API_URL.
// We avoid silently falling back to localhost in production.
if (isProd && !envApiUrl) {
  // eslint-disable-next-line no-console
  console.error(
    '[Config] REACT_APP_API_URL is required in production. Example: https://your-backend.com/api'
  );
}

// In production we do NOT fall back to localhost or relative /api.
// Deployments must provide REACT_APP_API_URL.
const baseURL = isProd ? envApiUrl : envApiUrl || 'http://localhost:5000/api';

const API = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Attach JWT from localStorage to every request */
API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** On 401, clear stale auth so UI can redirect to login */
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const publicAuthPaths = ['/auth/login', '/auth/register', '/auth/forgot-password'];
    const isPublicAuth = publicAuthPaths.some((p) => error.config?.url?.includes(p));
    if (error.response?.status === 401 && !isPublicAuth) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default API;
