import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from './LanguageSelector';

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, loading, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/login', { state: { message: t('nav.logoutSuccess') } });
  };

  const guestLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/questions', label: t('nav.questions') },
    { to: '/subscriptions', label: t('nav.plans') },
    { to: '/login', label: t('nav.login') },
    { to: '/register', label: t('nav.register') },
  ];

  const authLinks = [
    { to: '/', label: t('nav.home') },
    { to: '/questions', label: t('nav.questions') },
    { to: '/subscriptions', label: t('nav.plans') },
    { to: '/social', label: t('nav.social') },
    { to: '/ask', label: t('nav.ask') },
    { to: '/profile', label: t('nav.profile') },
  ];

  const links = isAuthenticated ? authLinks : guestLinks;

  const userMenuItem =
    !loading && isAuthenticated && user ? (
      <li className="navbar-user-menu-item">
        <Link
          to="/profile"
          className="navbar-user"
          onClick={() => setMenuOpen(false)}
        >
          <img
            src={user.profileImage}
            alt={`${user.name}'s profile`}
            className="navbar-avatar"
          />
          <span className="navbar-username" title={user.name}>
            {t('nav.hiUser', { name: user.name })}
          </span>
        </Link>
      </li>
    ) : null;

  return (
    <nav className="navbar" id="main-navbar" aria-label={t('nav.mainNavigation')}>
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon" aria-hidden="true">
            📚
          </span>
          <span className="brand-text">StackClone</span>
        </Link>

        <LanguageSelector compact className="navbar-language navbar-language-desktop" />

        {!loading && isAuthenticated && user && (
          <div className="navbar-user-wrap navbar-user-desktop">
            <Link to="/profile" className="navbar-user" onClick={() => setMenuOpen(false)}>
              <img
                src={user.profileImage}
                alt={`${user.name}'s profile`}
                className="navbar-avatar"
              />
              <span className="navbar-username" title={user.name}>
                {t('nav.hiUser', { name: user.name })}
              </span>
            </Link>
          </div>
        )}

        <button
          type="button"
          className={`navbar-toggle ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={t('nav.toggleNavigation')}
          aria-expanded={menuOpen}
          id="navbar-toggle-btn"
        >
          <span />
          <span />
          <span />
        </button>

        <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
          <li className="navbar-lang-menu-item">
            <LanguageSelector className="navbar-language-mobile" />
          </li>
          {links.map(({ to, label }) => (
            <li key={to}>
              <Link
                to={to}
                className={`nav-link ${location.pathname === to ? 'active' : ''}`}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            </li>
          ))}
          {userMenuItem}
          {isAuthenticated && (
            <li className="nav-logout-item">
              <button
                type="button"
                className="nav-link nav-logout-btn"
                onClick={handleLogout}
                id="nav-logout-btn"
              >
                {t('nav.logout')}
              </button>
            </li>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;
