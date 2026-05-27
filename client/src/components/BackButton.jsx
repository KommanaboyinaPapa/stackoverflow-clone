import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import '../styles/BackButton.css';

const BackButton = ({ className = '' }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleBack = () => {
    navigate(-1);
  };

  return (
    <button
      className={`back-button ${className}`}
      onClick={handleBack}
      aria-label={t('common.back')}
      title={t('common.back')}
    >
      ← {t('common.back')}
    </button>
  );
};

export default BackButton;
