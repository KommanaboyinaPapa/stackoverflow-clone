export const DEVICE_ID_KEY = 'stackclone_device_id';
export const SESSION_ID_KEY = 'stackclone_session_id';

export const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `dev_${Date.now()}`;
  }
};

export const getSessionId = () => {
  try {
    return localStorage.getItem(SESSION_ID_KEY) || '';
  } catch {
    return '';
  }
};

export const setSessionId = (sessionId) => {
  try {
    if (sessionId) {
      localStorage.setItem(SESSION_ID_KEY, sessionId);
    }
  } catch {
    /* ignore */
  }
};

export const clearSessionId = () => {
  try {
    localStorage.removeItem(SESSION_ID_KEY);
  } catch {
    /* ignore */
  }
};

export const getDeviceContext = () => ({
  deviceId: getDeviceId(),
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
});
