import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

/**
 * Shown when a logged-out user tries to use a protected action (e.g. post answer).
 */
const LoginPrompt = ({ message }) => {
  const { t } = useLanguage();
  const prompt = message || t('auth.loginPrompt', 'You need to be logged in to do this.');

  return (
    <div className="login-prompt">
      <p>{prompt}</p>
      <div className="login-prompt-actions">
        <Link to="/login" className="btn btn-primary">
          {t('auth.loginBtn')}
        </Link>
        <Link to="/register" className="btn btn-outline">
          {t('auth.registerBtn')}
        </Link>
      </div>
    </div>
  );
};

export default LoginPrompt;
