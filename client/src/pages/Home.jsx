import React from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';

const Home = () => {
  const { t } = useLanguage();

  return (
    <div className="page home-page">
      <div className="hero-section">
        <h1>{t('home.title')}</h1>
        <p className="hero-subtitle">{t('home.subtitle')}</p>
        <div className="hero-actions">
          <Link to="/questions" className="btn btn-primary">
            {t('home.browse')}
          </Link>
          <Link to="/ask" className="btn btn-outline">
            {t('home.ask')}
          </Link>
          <Link to="/register" className="btn btn-outline">
            {t('home.join')}
          </Link>
        </div>
      </div>

      <p className="features-section-label">{t('home.featuresLabel')}</p>
      <div className="features-grid">
        <Link to="/questions" className="feature-card feature-card-link">
          <div className="feature-icon">❓</div>
          <h3>{t('home.featAskTitle')}</h3>
          <p>{t('home.featAskDesc')}</p>
        </Link>
        <Link to="/questions" className="feature-card feature-card-link">
          <div className="feature-icon">💡</div>
          <h3>{t('home.featShareTitle')}</h3>
          <p>{t('home.featShareDesc')}</p>
        </Link>
        <Link to="/questions" className="feature-card feature-card-link">
          <div className="feature-icon">⬆️</div>
          <h3>{t('home.featVoteTitle')}</h3>
          <p>{t('home.featVoteDesc')}</p>
        </Link>
      </div>
    </div>
  );
};

export default Home;
