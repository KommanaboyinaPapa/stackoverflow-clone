import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
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
