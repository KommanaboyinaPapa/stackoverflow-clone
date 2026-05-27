import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

/**
 * Wraps pages that require login (Ask Question, Profile).
 * Redirects to /login if user is not authenticated.
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page auth-page">
        <div className="auth-card">
          <div className="profile-loading">{t('common.loading')}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          message: t('auth.loginRequired', 'Please log in to access this page.'),
        }}
      />
    );
  }

  return children;
};

export default ProtectedRoute;
