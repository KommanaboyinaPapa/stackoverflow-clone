import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import LanguageSelector from '../components/LanguageSelector';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  getLoginHistory,
  getProfile,
  trustDevice,
  updatePhone,
} from '../services/authService';
import {
  getTransferHistory,
  searchUsers,
  transferPoints,
} from '../services/pointsService';
import { deleteAnswer } from '../services/answerService';
import getErrorMessage from '../utils/getErrorMessage';

const formatDate = (dateStr) =>
  dateStr
    ? new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const formatDeviceType = (rawType, t) => {
  const type = String(rawType || '').toLowerCase();
  if (!type) return t('common.unknown');
  if (type === 'mobile') return t('profile.deviceTypeMobile');
  if (type === 'tablet') return t('profile.deviceTypeMobile');
  if (type === 'laptop') return t('profile.deviceTypeLaptop');
  if (type === 'desktop') return t('profile.deviceTypeDesktop');
  return rawType;
};

const formatOperatingSystem = (rawOs, t) => {
  const os = String(rawOs || '').trim();
  if (!os) return t('common.unknown');
  // Backward-compat for older stored values
  if (os === 'Mac') return 'macOS';
  return os;
};

const formatIpAddress = (raw, t) => {
  if (!raw) return t('common.unknown');
  const host =
    typeof window !== 'undefined' && window.location ? window.location.hostname : '';

  const ip = String(raw);
  // Normalize IPv6-mapped IPv4 addresses for display (e.g. ::ffff:127.0.0.1)
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;

  const isLocalApp = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const isLocalIp = normalized === '127.0.0.1' || normalized === '::1';

  if (isLocalApp && isLocalIp) {
    return t('profile.localhost');
  }

  return normalized;
};

const Profile = () => {
  const { t, resumeLanguageOtpFlow, getPendingLanguage } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, refreshUser } = useAuth();
  const [user, setUser] = useState(null);
  const [myQuestions, setMyQuestions] = useState([]);
  const [myAnswers, setMyAnswers] = useState([]);
  const [stats, setStats] = useState({ questionsCount: 0, answersCount: 0 });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [transferSearch, setTransferSearch] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferSuccess, setTransferSuccess] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [phoneSuccess, setPhoneSuccess] = useState('');
  const [highlightPhone, setHighlightPhone] = useState(
    () => location.state?.focusPhone || false
  );
  const [loginHistory, setLoginHistory] = useState([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [trustMessage, setTrustMessage] = useState('');
  const [trustError, setTrustError] = useState('');

  const loadProfile = useCallback(async () => {
    try {
      const data = await getProfile();
      setUser(data.user);
      setMyQuestions(data.myQuestions || []);
      setMyAnswers(data.myAnswers || []);
      setStats(
        data.stats || {
          questionsCount: data.myQuestions?.length || 0,
          answersCount: data.myAnswers?.length || 0,
        }
      );
    } catch (err) {
      setError(getErrorMessage(err, t('profile.loadFailed')));
      if (err.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
      }
    }
  }, [logout, navigate, t]);

  const loadHistory = useCallback(async () => {
    try {
      const data = await getTransferHistory();
      setHistory(data.history || []);
    } catch {
      setHistory([]);
    }
  }, []);

  const loadLoginHistory = useCallback(async () => {
    setLoginHistoryLoading(true);
    setTrustMessage('');
    setTrustError('');
    try {
      const data = await getLoginHistory();
      setLoginHistory(data.history || []);
    } catch {
      setLoginHistory([]);
    } finally {
      setLoginHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadHistory(), loadLoginHistory()]);
      setLoading(false);
    };
    init();
  }, [loadProfile, loadHistory, loadLoginHistory]);

  useEffect(() => {
    if (user?.phone !== undefined) {
      setPhoneInput(user.phone || '');
    }
  }, [user?.phone]);

  useEffect(() => {
    if (location.state?.focusPhone) {
      setHighlightPhone(true);
    }
  }, [location.state?.focusPhone]);

  useEffect(() => {
    if (activeTab !== 'points' || transferSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await searchUsers(transferSearch.trim());
        setSearchResults(data.users || []);
      } catch {
        setSearchResults([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [transferSearch, activeTab]);

  const handleLogout = () => {
    logout();
    navigate('/login', { state: { message: t('profile.logoutSuccess') } });
  };

  const handleSectionNav = (sectionId, tabName) => {
    setActiveTab(tabName);
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setTransferError('');
    setTransferSuccess('');

    const search = selectedUser
      ? selectedUser.email
      : transferSearch.trim();

    if (!search) {
      setTransferError(t('profile.transferSearchError'));
      return;
    }

    setTransferLoading(true);
    try {
      const data = await transferPoints({
        search,
        amount: Number(transferAmount),
      });
      setTransferSuccess(data.message);
      setUser((u) => ({ ...u, points: data.points }));
      setTransferAmount('');
      setTransferSearch('');
      setSelectedUser(null);
      setSearchResults([]);
      await loadHistory();
      await refreshUser();
    } catch (err) {
      setTransferError(
        err.response?.data?.message ||
          getErrorMessage(err, t('profile.transferFailed'))
      );
    } finally {
      setTransferLoading(false);
    }
  };

  const selectUser = (u) => {
    setSelectedUser(u);
    setTransferSearch(`${u.name} (${u.email})`);
    setSearchResults([]);
  };

  const handleTrustDevice = async (deviceId) => {
    setTrustMessage('');
    setTrustError('');
    try {
      await trustDevice(deviceId);
      setTrustMessage(t('loginSecurity.trustSuccess'));
      await loadLoginHistory();
    } catch (err) {
      setTrustError(
        err.response?.data?.message ||
          getErrorMessage(err, t('profile.couldNotTrustDevice'))
      );
    }
  };

  const handleDeleteAnswer = async (answerId) => {
    if (!window.confirm(t('profile.deleteAnswerConfirm'))) {
      return;
    }

    setError('');
    try {
      const data = await deleteAnswer(answerId);
      setMyAnswers((prev) => prev.filter((answer) => answer._id !== answerId));
      setStats((prev) => ({
        ...prev,
        answersCount: Math.max(0, (prev.answersCount || 1) - 1),
      }));
      setUser((prev) => ({
        ...prev,
        points: data.authorPoints ?? prev.points,
      }));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          getErrorMessage(err, t('profile.deleteAnswerError', 'Could not remove the answer.'))
      );
    }
  };

  const handleSavePhone = async (e) => {
    e.preventDefault();
    setPhoneError('');
    setPhoneSuccess('');
    setPhoneSaving(true);
    try {
      await updatePhone(phoneInput.trim());
      await refreshUser();
      await loadProfile();
      setPhoneSuccess(t('language.mobileSavedProfile'));
      setHighlightPhone(false);

      const pending =
        location.state?.pendingLanguage || getPendingLanguage();
      if (pending && pending !== 'fr') {
        setTimeout(() => resumeLanguageOtpFlow(pending), 500);
      }
    } catch (err) {
      setPhoneError(
        err.response?.data?.message ||
          getErrorMessage(err, t('profile.phoneSaveError', 'Could not save mobile number.'))
      );
    } finally {
      setPhoneSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page profile-page">
        <div className="profile-loading">
          <div className="loading-spinner" />
          <p>{t('profile.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page profile-page">
        <div className="alert alert-error">{error}</div>
      </div>
    );
  }

  const memberSince = formatDate(user?.createdAt);
  const totalPoints = user?.points ?? 0;
  const canTransfer = totalPoints > 10;

  const trustedDevices = loginHistory.reduce((acc, entry) => {
    if (!entry.isTrusted) return acc;
    if (acc.some((d) => d.deviceId === entry.deviceId)) return acc;
    acc.push(entry);
    return acc;
  }, []);

  return (
    <div className="page profile-page profile-page-wide">
      <div className="page-content">
        <BackButton />
        <div className="profile-layout">
          <aside className="profile-sidebar">
            <div className="profile-card profile-card-enhanced profile-summary-card">
              <div className="profile-card-header">
                <span className="profile-card-label">{t('profile.userSummary')}</span>
                <h2>{user?.name}</h2>
              </div>
              <img src={user?.profileImage} alt={user?.name} className="profile-pic" />
              <p className="profile-subtitle">{user?.email}</p>

              <div className="profile-summary-grid">
                <div className="stat-item">
                  <span className="stat-value">{stats.answersCount}</span>
                  <span className="stat-label">{t('profile.answers')}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stats.questionsCount}</span>
                  <span className="stat-label">{t('profile.questions')}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{user?.friends?.length ?? 0}</span>
                  <span className="stat-label">{t('profile.connections')}</span>
                </div>
              </div>
            </div>

            <div className="profile-card profile-rewards-card">
              <div className="profile-card-header">
                <span className="profile-card-label">{t('profile.rewardPoints')}</span>
                <h3>{t('profile.points')}</h3>
              </div>
              <div className="profile-points-badge profile-points-highlight">
                <span className="points-value">{totalPoints}</span>
                <span className="points-label">{t('profile.points')}</span>
              </div>
              <ul className="reward-rule-list">
                <li>+5 per answer</li>
                <li>+5 bonus at 5 upvotes</li>
                <li>−1 on downvote</li>
              </ul>
            </div>

            <div className="profile-language-block">
              <h3>{t('profile.languageSettings')}</h3>
              <p className="form-hint">{t('profile.languageHint')}</p>
              <LanguageSelector />
            </div>

            <div className="profile-actions">
              <Link to="/ask" className="btn btn-primary btn-block">
                {t('profile.askBtn')}
              </Link>
              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={handleLogout}
              >
                {t('profile.logout')}
              </button>
            </div>
          </aside>

          <section className="profile-main">
            <div className="profile-tabs">
              <button
                type="button"
                className={`profile-tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => handleSectionNav('profile-overview', 'overview')}
              >
                {t('profile.tabOverview')}
              </button>
              <button
                type="button"
                className={`profile-tab ${activeTab === 'questions' ? 'active' : ''}`}
                onClick={() => handleSectionNav('questions', 'questions')}
              >
                {t('profile.tabQuestions')}
                {' '}
                <span className="tab-count">({myQuestions.length})</span>
              </button>
              <button
                type="button"
                className={`profile-tab ${activeTab === 'answers' ? 'active' : ''}`}
                onClick={() => handleSectionNav('answers', 'answers')}
              >
                {t('profile.tabAnswers')}
                {' '}
                <span className="tab-count">({myAnswers.length})</span>
              </button>
              <button
                type="button"
                className={`profile-tab ${activeTab === 'login' ? 'active' : ''}`}
                onClick={() => handleSectionNav('profile-login-history', 'login')}
              >
                {t('profile.tabLoginHistory')}
              </button>
              <button
                type="button"
                className={`profile-tab ${activeTab === 'points' ? 'active' : ''}`}
                onClick={() => handleSectionNav('points-transfer', 'points')}
              >
                {t('profile.tabPoints')}
              </button>
            </div>

            <section id="profile-overview" className="profile-section profile-overview-section">
              <div className="profile-section-header">
                <div>
                  <p className="section-label">{t('nav.profile')}</p>
                  <h2 className="profile-section-heading">{t('profile.profileOverview')}</h2>
                </div>
              </div>
              <div className="profile-section-card profile-overview-card">
                <div className="profile-details">
                  <div className="detail-row">
                    <span className="detail-label">{t('profile.memberSince')}</span>
                    <span className="detail-value">{memberSince}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">{t('profile.phone')}</span>
                    <span className="detail-value">
                      {user?.phone?.trim() ? user.phone : t('profile.phoneNotSet')}
                    </span>
                  </div>
                </div>

                <div
                  className={`profile-phone-block ${highlightPhone ? 'profile-phone-block-highlight' : ''}`}
                  id="profile-phone-section"
                >
                  <h3>{t('profile.editPhone')}</h3>
                  {highlightPhone && (
                    <p className="alert alert-info profile-phone-alert">
                      {t('language.profileHighlight')}
                    </p>
                  )}
                  {phoneError && <div className="alert alert-error">{phoneError}</div>}
                  {phoneSuccess && <div className="alert alert-success">{phoneSuccess}</div>}
                  <form onSubmit={handleSavePhone} className="profile-phone-form">
                    <div className="form-group">
                      <label htmlFor="profile-phone">{t('language.mobileLabel')}</label>
                      <input
                        id="profile-phone"
                        type="tel"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder={t('language.mobilePlaceholder')}
                        disabled={phoneSaving}
                      />
                    </div>
                    <p className="form-hint">{t('language.profilePhoneHint')}</p>
                    <button
                      type="submit"
                      className="btn btn-primary btn-block"
                      disabled={phoneSaving}
                    >
                      {phoneSaving ? t('common.loading') : t('language.saveMobile')}
                    </button>
                  </form>
                </div>
              </div>
            </section>

            <section id="questions" className="profile-section">
              <div className="profile-section-header">
                <div>
                  <p className="section-label">{t('profile.userActivity')}</p>
                  <h2 className="profile-section-heading">{t('profile.tabQuestions')}</h2>
                </div>
                <span className="section-count">{t('profile.questionsCount', { count: myQuestions.length })}</span>
              </div>
              <div className="profile-section-card">
                {myQuestions.length === 0 ? (
                  <div className="empty-state profile-empty">
                    <p>{t('profile.noQuestions')}</p>
                    <Link to="/ask" className="btn btn-primary">
                      {t('profile.firstQuestion')}
                    </Link>
                  </div>
                ) : (
                  <ul className="profile-list">
                    {myQuestions.map((q) => (
                      <li key={q._id} className="profile-list-item">
                        <Link to={`/questions/${q._id}`} className="profile-item-title">
                          {q.title}
                        </Link>
                        <p className="profile-item-excerpt">
                          {q.description?.length > 120
                            ? `${q.description.slice(0, 120)}…`
                            : q.description}
                        </p>
                        <div className="profile-item-meta">
                          <span>{q.voteScore ?? 0} {t('questions.votes')}</span>
                          <span>{q.answerCount ?? 0} {t('questions.answers')}</span>
                          <span>{formatDate(q.createdAt)}</span>
                        </div>
                        <div className="profile-item-actions">
                          <Link
                            to={`/questions/${q._id}`}
                            className="btn btn-outline btn-sm"
                          >
                            {t('profile.viewQuestion')}
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section id="answers" className="profile-section">
              <div className="profile-section-header">
                <div>
                  <p className="section-label">{t('profile.userActivity')}</p>
                  <h2 className="profile-section-heading">{t('profile.tabAnswers')}</h2>
                </div>
                <span className="section-count">{t('profile.answersCount', { count: myAnswers.length })}</span>
              </div>
              <div className="profile-section-card">
                {myAnswers.length === 0 ? (
                  <div className="empty-state profile-empty">
                    <p>{t('profile.noAnswers')}</p>
                    <Link to="/questions" className="btn btn-outline">
                      {t('profile.browse')}
                    </Link>
                  </div>
                ) : (
                  <ul className="profile-list">
                    {myAnswers.map((a) => (
                      <li key={a._id} className="profile-list-item">
                        {a.question && (
                          <Link
                            to={`/questions/${a.question._id}#answer-${a._id}`}
                            className="profile-item-title"
                          >
                            {t('profile.answerFor', { title: a.question.title })}
                          </Link>
                        )}
                        <p className="profile-item-excerpt">
                          {a.body?.length > 140 ? `${a.body.slice(0, 140)}…` : a.body}
                        </p>
                        <div className="profile-item-meta">
                          <span>{a.voteScore ?? 0} {t('questions.votes')}</span>
                          <span>{formatDate(a.createdAt)}</span>
                        </div>
                        <div className="profile-item-actions">
                          <Link
                            to={`/questions/${a.question._id}#answer-${a._id}`}
                            className="btn btn-outline btn-sm"
                          >
                            {t('profile.viewAnswer')}
                          </Link>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleDeleteAnswer(a._id)}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section
              className="profile-login-security-panel login-history-section"
              id="profile-login-history"
              aria-labelledby="profile-login-history-heading"
            >
              <h2 id="profile-login-history-heading" className="profile-section-heading">
                {t('profile.trustedHistoryTitle')}
              </h2>
              {trustError && <div className="alert alert-error">{trustError}</div>}
              {trustMessage && <div className="alert alert-success">{trustMessage}</div>}
              {loginHistoryLoading ? (
                <div className="profile-login-loading">
                  <div className="loading-spinner" />
                  <p>{t('common.loading')}</p>
                </div>
              ) : loginHistory.length === 0 ? (
                <p className="login-history-empty">{t('loginSecurity.empty')}</p>
              ) : (
                <ul className="login-history-list">
                  {loginHistory.map((entry) => (
                    <li
                      key={entry._id}
                      className={`login-history-item ${entry.isCurrent ? 'current' : ''}`}
                    >
                      <div className="login-history-main">
                        <div className="login-history-device-name">
                          {entry.device || entry.deviceName || t('common.unknown')}
                        </div>
                        <div className="login-history-meta">
                          <span className="login-history-label">{t('profile.browser')}</span>{' '}
                          <span>{entry.browser || t('common.unknown')}</span>
                          <br />
                          <span className="login-history-label">{t('profile.os')}</span>{' '}
                          <span>{formatOperatingSystem(entry.operatingSystem, t)}</span>
                          <br />
                          <span className="login-history-label">{t('profile.deviceType')}</span>{' '}
                          <span>{formatDeviceType(entry.deviceType, t)}</span>
                          <br />
                          <span className="login-history-label">{t('loginSecurity.ip')}:</span>{' '}
                          <span>{formatIpAddress(entry.ipAddress, t)}</span>
                          <br />
                          <span className="login-history-label">{t('profile.time')}</span>{' '}
                          <span>{formatDate(entry.loginAt)}</span>
                        </div>
                      </div>
                      <div className="login-history-badges">
                        {entry.isCurrent && (
                          <span className="session-badge">{t('loginSecurity.currentSession')}</span>
                        )}
                        {entry.isTrusted && (
                          <span className="trusted-badge">{t('loginSecurity.trusted')}</span>
                        )}
                      </div>
                      {!entry.isTrusted && (
                        <div className="login-history-actions">
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleTrustDevice(entry.deviceId)}
                          >
                            {t('loginSecurity.trustBtn')}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <h2 className="profile-section-heading profile-section-heading-spaced">
                {t('profile.trustedDevices')}
              </h2>
              {loginHistoryLoading ? (
                <p className="login-history-hint">{t('common.loading')}</p>
              ) : trustedDevices.length === 0 ? (
                <p className="login-history-empty login-history-empty-sub">
                  {t('profile.noTrustedDevices', 'No trusted devices yet. Trust a device from your login history after signing in.')}
                </p>
              ) : (
                <ul className="login-history-list trusted-devices-list">
                  {trustedDevices.map((entry) => (
                    <li
                      key={`trusted-${entry.deviceId}`}
                      className="login-history-item trusted-device-item"
                    >
                      <div className="login-history-main">
                        <div className="login-history-device-name">
                          {entry.device || entry.deviceName || t('common.unknown')}
                        </div>
                        <div className="login-history-meta">
                          <span className="login-history-label">{t('profile.browser')}</span>{' '}
                          <span>{entry.browser || t('common.unknown')}</span>
                          <br />
                          <span className="login-history-label">{t('profile.os')}</span>{' '}
                          <span>{formatOperatingSystem(entry.operatingSystem, t)}</span>
                          <br />
                          <span className="login-history-label">{t('profile.deviceType')}</span>{' '}
                          <span>{formatDeviceType(entry.deviceType, t)}</span>
                          <br />
                          <span className="login-history-label">{t('loginSecurity.ip')}:</span>{' '}
                          <span>{formatIpAddress(entry.ipAddress, t)}</span>
                          <br />
                          <span>{t('profile.lastLogin')} {formatDate(entry.loginAt)}</span>
                        </div>
                      </div>
                      <div className="login-history-badges">
                        {entry.isCurrent && (
                          <span className="session-badge">{t('loginSecurity.currentSession')}</span>
                        )}
                        <span className="trusted-badge">{t('loginSecurity.trusted')}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section id="points-transfer" className="profile-section">
              <div className="profile-section-header">
                <div>
                  <p className="section-label">{t('profile.rewardsLabel')}</p>
                  <h2 className="profile-section-heading">{t('profile.tabPoints')}</h2>
                </div>
                <span className="section-count">
                  {t('profile.pointsAvailable', { count: totalPoints })}
                </span>
              </div>
              <div className="profile-section-card">
                <div className="transfer-summary">
                  <div className="current-points-card">
                    <span className="current-points-label">{t('profile.currentRewardBalance')}</span>
                    <span className="current-points-value">{totalPoints}</span>
                  </div>
                  <p className="profile-note transfer-rule">
                    {t('profile.transferRule')}
                  </p>
                </div>

                <p className="profile-note">
                  {t('profile.transferHint')}
                </p>

                {transferError && <div className="alert alert-error">{transferError}</div>}
                {transferSuccess && (
                  <div className="alert alert-success">{transferSuccess}</div>
                )}

                <form className="transfer-form" onSubmit={handleTransfer}>
                  <div className="form-group">
                    <label htmlFor="transfer-search">{t('profile.findUser')}</label>
                    <input
                      id="transfer-search"
                      type="text"
                      placeholder={t('profile.findUserPlaceholder')}
                      value={transferSearch}
                      onChange={(e) => {
                        setTransferSearch(e.target.value);
                        setSelectedUser(null);
                        setTransferError('');
                      }}
                      disabled={!canTransfer || transferLoading}
                    />
                    {searchResults.length > 0 && (
                      <ul className="search-results">
                        {searchResults.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              className="search-result-btn"
                              onClick={() => selectUser(u)}
                            >
                              <span>{u.name}</span>
                              <span className="search-result-email">{u.email}</span>
                              <span className="search-result-points">
                                {u.points} {t('profile.pointsShort')}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="form-group">
                    <label htmlFor="transfer-amount">{t('profile.pointsToTransfer')}</label>
                    <input
                      id="transfer-amount"
                      type="number"
                      min="1"
                      step="1"
                      placeholder={t('profile.pointsPlaceholder')}
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      disabled={!canTransfer || transferLoading}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!canTransfer || transferLoading}
                  >
                    {transferLoading ? t('profile.transferring') : t('profile.transferBtn')}
                  </button>
                </form>

                <h2 className="history-title">{t('profile.history')}</h2>
                {history.length === 0 ? (
                  <p className="no-history">{t('profile.noTransfers')}</p>
                ) : (
                  <ul className="transfer-history-list">
                    {history.map((item) => (
                      <li
                        key={item._id}
                        className={`transfer-history-item ${item.type}`}
                      >
                        <span className={`transfer-badge ${item.type}`}>
                          {item.type === 'sent' ? t('profile.sent') : t('profile.received')}
                        </span>
                        <span className="transfer-amount">
                          {item.type === 'sent' ? t('profile.sentPrefix') : t('profile.receivedPrefix')}
                          {item.amount} {t('profile.pointsShort')}
                        </span>
                        <span className="transfer-party">
                          {item.type === 'sent' ? t('profile.to') : t('profile.from')}{' '}
                          <strong>{item.otherUser?.name}</strong>
                        </span>
                        <span className="transfer-date">{formatDate(item.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;
