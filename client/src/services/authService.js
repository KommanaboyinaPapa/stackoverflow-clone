import API from './api';
import {
  clearSessionId,
  getDeviceContext,
  getSessionId,
  setSessionId,
} from '../utils/deviceId';

export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

export const saveAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  clearSessionId();
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const isAuthenticated = () => !!getToken();

const applyAuthResponse = (data) => {
  if (data.token && data.user) {
    saveAuth(data.token, data.user);
    if (data.sessionId) {
      setSessionId(data.sessionId);
    }
  }
  return data;
};

export const register = async ({ name, email, password, profileImage, phone }) => {
  const { data } = await API.post('/auth/register', {
    name,
    email,
    password,
    profileImage,
    phone,
    ...getDeviceContext(),
  });
  return applyAuthResponse(data);
};

export const login = async ({
  email,
  password,
  trustDevice = true,
  forceDeviceVerification = false,
}) => {
  const { data } = await API.post('/auth/login', {
    email,
    password,
    trustDevice,
    forceDeviceVerification,
    ...getDeviceContext(),
  });
  if (!data.requiresDeviceVerification) {
    applyAuthResponse(data);
  }
  return data;
};

export const verifyDeviceLogin = async ({
  pendingSessionId,
  otp,
  trustDevice = true,
}) => {
  const { data } = await API.post('/auth/verify-device-login', {
    pendingSessionId,
    otp,
    trustDevice,
  });
  return applyAuthResponse(data);
};

export const getLoginHistory = async () => {
  const { deviceId } = getDeviceContext();
  const sessionId = getSessionId();
  const { data } = await API.get('/auth/login-history', {
    params: { deviceId, sessionId },
  });
  return data;
};

export const trustDevice = async (deviceId) => {
  const { data } = await API.post('/auth/trust-device', { deviceId });
  return data;
};

export const getProfile = async () => {
  const { data } = await API.get('/auth/profile');
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data;
};

export const updatePhone = async (phone) => {
  const { data } = await API.put('/auth/phone', { phone });
  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  return data;
};

export const forgotPassword = async ({ email, phone }) => {
  const { data } = await API.post('/auth/forgot-password', { email, phone });
  return data;
};

export const logout = () => {
  clearAuth();
};
