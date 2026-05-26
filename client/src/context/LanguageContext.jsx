import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from './AuthContext';
import { USER_KEY } from '../services/authService';
import {
  PENDING_LANG_KEY,
  STORAGE_LANG_KEY,
  getNested,
  interpolate,
  translations,
} from '../i18n/translations';

const LanguageContext = createContext(null);

const getInitialLanguage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_LANG_KEY);
    if (stored && translations[stored]) return stored;
  } catch {
    /* ignore */
  }
  return 'en';
};

export const LanguageProvider = ({ children }) => {
  const { isAuthenticated, user, refreshUser } = useAuth();
  const [language, setLanguage] = useState(getInitialLanguage);
  const [otpModal, setOtpModal] = useState(null);

  useEffect(() => {
    if (user?.preferredLanguage && translations[user.preferredLanguage]) {
      setLanguage(user.preferredLanguage);
      localStorage.setItem(STORAGE_LANG_KEY, user.preferredLanguage);
    }
  }, [user?.preferredLanguage]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const applyLanguageLocal = useCallback((code) => {
    setLanguage(code);
    localStorage.setItem(STORAGE_LANG_KEY, code);
  }, []);

  const setPendingLanguage = useCallback((code) => {
    if (code) {
      sessionStorage.setItem(PENDING_LANG_KEY, code);
    }
  }, []);

  const getPendingLanguage = useCallback(() => {
    try {
      return sessionStorage.getItem(PENDING_LANG_KEY);
    } catch {
      return null;
    }
  }, []);

  const clearPendingLanguage = useCallback(() => {
    try {
      sessionStorage.removeItem(PENDING_LANG_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key, vars) => {
      const pack = translations[language] || translations.en;
      const value = getNested(pack, key) ?? getNested(translations.en, key) ?? key;
      return interpolate(value, vars);
    },
    [language]
  );

  const needsMobileForLanguage = useCallback(
    (code) => code !== 'fr' && !user?.phone?.trim(),
    [user?.phone]
  );

  const openOtpModal = useCallback(
    (code, mode = 'otp', options = {}) => {
      setPendingLanguage(code);
      setOtpModal({ targetLanguage: code, mode, ...options });
    },
    [setPendingLanguage]
  );

  const resumeLanguageOtpFlow = useCallback(
    (code) => {
      const target = code || getPendingLanguage();
      if (!target) return;
      openOtpModal(target, 'otp', { resumeOtp: true });
    },
    [getPendingLanguage, openOtpModal]
  );

  const requestLanguageChange = useCallback(
    (code) => {
      if (code === language) return;

      if (!isAuthenticated) {
        applyLanguageLocal(code);
        return { guest: true };
      }

      setPendingLanguage(code);

      if (needsMobileForLanguage(code)) {
        openOtpModal(code, 'phone-required');
        return { requiresPhone: true };
      }

      openOtpModal(code, 'otp');
      return { requiresOtp: true };
    },
    [
      language,
      isAuthenticated,
      applyLanguageLocal,
      setPendingLanguage,
      needsMobileForLanguage,
      openOtpModal,
    ]
  );

  const completeLanguageChange = useCallback(
    async (code) => {
      applyLanguageLocal(code);
      clearPendingLanguage();
      if (isAuthenticated) {
        try {
          const raw = localStorage.getItem(USER_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.preferredLanguage = code;
            localStorage.setItem(USER_KEY, JSON.stringify(parsed));
          }
          await refreshUser();
        } catch {
          /* profile refresh optional */
        }
      }
      setOtpModal(null);
    },
    [applyLanguageLocal, isAuthenticated, refreshUser, clearPendingLanguage]
  );

  const closeOtpModal = useCallback(() => {
    setOtpModal(null);
  }, []);

  const value = useMemo(
    () => ({
      language,
      t,
      requestLanguageChange,
      completeLanguageChange,
      applyLanguageLocal,
      otpModal,
      closeOtpModal,
      openOtpModal,
      resumeLanguageOtpFlow,
      setPendingLanguage,
      getPendingLanguage,
      clearPendingLanguage,
      needsMobileForLanguage,
    }),
    [
      language,
      t,
      requestLanguageChange,
      completeLanguageChange,
      applyLanguageLocal,
      otpModal,
      closeOtpModal,
      openOtpModal,
      resumeLanguageOtpFlow,
      setPendingLanguage,
      getPendingLanguage,
      clearPendingLanguage,
      needsMobileForLanguage,
    ]
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return ctx;
};

export default LanguageContext;
