import React from 'react';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

const LanguageSelector = ({ className = '', compact = false }) => {
  const { language, requestLanguageChange, t } = useLanguage();
  const { isAuthenticated } = useAuth();

  const handleChange = (e) => {
    const code = e.target.value;
    if (code === language) return;
    requestLanguageChange(code);
    e.target.value = language;
  };

  return (
    <div className={`language-selector language-premium ${compact ? 'language-selector-compact' : ''} ${className}`}>
      <label htmlFor="app-language-select" className="language-selector-label">
        {compact ? '🌐' : t('nav.language')}
      </label>
      <select
        id="app-language-select"
        className="language-select"
        value={language}
        onChange={handleChange}
        title={t('language.select')}
        aria-label={t('language.select')}
      >
        {LANGUAGE_OPTIONS.map((opt) => (
          <option key={opt.code} value={opt.code}>
            {opt.label}
          </option>
        ))}
      </select>
      {!isAuthenticated && (
        <span className="language-guest-hint" title={t('language.guestApplied')}>
          *
        </span>
      )}
    </div>
  );
};

export default LanguageSelector;
