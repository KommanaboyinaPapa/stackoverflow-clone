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
  const [activeTab, setActiveTab] = useState('questions');

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
      setError(getErrorMessage(err, 'Failed to load your profile.'));
      if (err.response?.status === 401) {
        logout();
        navigate('/login', { replace: true });
      }
    }
  }, [logout, navigate]);

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
    navigate('/login', { state: { message: 'You have been logged out.' } });
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setTransferError('');
    setTransferSuccess('');

    const search = selectedUser
      ? selectedUser.email
      : transferSearch.trim();

    if (!search) {
      setTransferError('Search for a user by name or email first.');
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
          getErrorMessage(err, 'Transfer failed.')
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
          getErrorMessage(err, 'Could not trust device.')
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
          getErrorMessage(err, 'Could not save mobile number.')
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
            <div className="profile-card profile-card-enhanced">
            <img src={user?.profileImage} alt={user?.name} className="profile-pic" />
            <h1>{user?.name}</h1>
            <p className="profile-subtitle">{user?.email}</p>

            <div className="profile-points-badge profile-points-highlight">
              <span className="points-value">{totalPoints}</span>
              <span className="points-label">{t('profile.points')}</span>
            </div>

            <p className="points-rules">
              +5 per answer · +5 bonus at 5 votes · −1 on downvote
            </p>

            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-value">{stats.questionsCount}</span>
                <span className="stat-label">{t('profile.questions')}</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.answersCount}</span>
                <span className="stat-label">{t('profile.answers')}</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{user?.friends?.length ?? 0}</span>
                <span className="stat-label">{t('profile.friends')}</span>
              </div>
            </div>

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
                <button type="submit" className="btn btn-primary btn-block" disabled={phoneSaving}>
                  {phoneSaving ? t('common.loading') : t('language.saveMobile')}
                </button>
              </form>
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
            </div>
          </aside>

          <section className="profile-main">
          <div
            className="profile-login-security-panel login-history-section"
            id="profile-login-history"
            aria-labelledby="profile-login-history-heading"
          >
            <h2 id="profile-login-history-heading" className="profile-section-heading">
              Login History
            </h2>
            {trustError && <div className="alert alert-error">{trustError}</div>}
            {trustMessage && <div className="alert alert-success">{trustMessage}</div>}
            {loginHistoryLoading ? (
              <div className="profile-login-loading">
                <div className="loading-spinner" />
                <p>{t('common.loading')}</p>
              </div>
            ) : loginHistory.length === 0 ? (
              <p className="login-history-empty">No login history yet.</p>
            ) : (
              <ul className="login-history-list">
                {loginHistory.map((entry) => (
                  <li
                    key={entry._id}
                    className={`login-history-item ${entry.isCurrent ? 'current' : ''}`}
                  >
                    <div className="login-history-main">
                      <div className="login-history-device-name">
                        {entry.device || entry.deviceName || 'Unknown device'}
                      </div>
                      <div className="login-history-meta">
                        <span className="login-history-label">Browser:</span>{' '}
                        <span>{entry.browser || 'Unknown'}</span>
                        <br />
                        <span className="login-history-label">Device:</span>{' '}
                        <span>{entry.deviceType || entry.deviceName || '—'}</span>
                        <br />
                        <span className="login-history-label">Time:</span>{' '}
                        <span>{formatDate(entry.loginAt)}</span>
                      </div>
                    </div>
                    <div className="login-history-badges">
                      {entry.isCurrent && (
                        <span className="session-badge">Current session</span>
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
              Trusted Devices
            </h2>
            {loginHistoryLoading ? (
              <p className="login-history-hint">{t('common.loading')}</p>
            ) : trustedDevices.length === 0 ? (
              <p className="login-history-empty login-history-empty-sub">
                No trusted devices yet. Trust a device from your login history after signing in.
              </p>
            ) : (
              <ul className="login-history-list trusted-devices-list">
                {trustedDevices.map((entry) => (
                  <li key={`trusted-${entry.deviceId}`} className="login-history-item trusted-device-item">
                    <div className="login-history-main">
                      <div className="login-history-device-name">
                        {entry.device || entry.deviceName || 'Unknown device'}
                      </div>
                      <div className="login-history-meta">
                        <span>{entry.browser}</span>
                        <span> · </span>
                        <span>{entry.deviceType}</span>
                        <br />
                        <span>Last login: {formatDate(entry.loginAt)}</span>
                      </div>
                    </div>
                    <div className="login-history-badges">
                      {entry.isCurrent && (
                        <span className="session-badge">Current session</span>
                      )}
                      <span className="trusted-badge">{t('loginSecurity.trusted')}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="profile-tabs">
            <button
              type="button"
              className={`profile-tab ${activeTab === 'questions' ? 'active' : ''}`}
              onClick={() => setActiveTab('questions')}
            >
              My Questions ({myQuestions.length})
            </button>
            <button
              type="button"
              className={`profile-tab ${activeTab === 'answers' ? 'active' : ''}`}
              onClick={() => setActiveTab('answers')}
            >
              My Answers ({myAnswers.length})
            </button>
            <button
              type="button"
              className={`profile-tab ${activeTab === 'points' ? 'active' : ''}`}
              onClick={() => setActiveTab('points')}
            >
              Points & Transfer
            </button>
          </div>

          {activeTab === 'questions' && (
            <div className="profile-activity">
              <h2>Questions you asked</h2>
              {myQuestions.length === 0 ? (
                <div className="empty-state profile-empty">
                  <p>You have not asked any questions yet.</p>
                  <Link to="/ask" className="btn btn-primary">
                    Ask Your First Question
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
                        <span>{q.voteScore ?? 0} votes</span>
                        <span>{q.answerCount ?? 0} answers</span>
                        <span>{formatDate(q.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'answers' && (
            <div className="profile-activity">
              <h2>Answers you posted</h2>
              {myAnswers.length === 0 ? (
                <div className="empty-state profile-empty">
                  <p>You have not posted any answers yet.</p>
                  <Link to="/questions" className="btn btn-outline">
                    Browse Questions
                  </Link>
                </div>
              ) : (
                <ul className="profile-list">
                  {myAnswers.map((a) => (
                    <li key={a._id} className="profile-list-item">
                      {a.question && (
                        <Link
                          to={`/questions/${a.question._id}`}
                          className="profile-item-title"
                        >
                          Re: {a.question.title}
                        </Link>
                      )}
                      <p className="profile-item-excerpt">
                        {a.body?.length > 140 ? `${a.body.slice(0, 140)}…` : a.body}
                      </p>
                      <div className="profile-item-meta">
                        <span>{a.voteScore ?? 0} votes</span>
                        <span>{formatDate(a.createdAt)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'points' && (
            <div className="profile-activity">
              <h2>Transfer points</h2>
              <p className="form-hint transfer-hint">
                You have <strong>{totalPoints}</strong> points.
                {canTransfer
                  ? ' Search by name or email, then transfer.'
                  : ' You need more than 10 points to transfer.'}
              </p>

              {transferError && <div className="alert alert-error">{transferError}</div>}
              {transferSuccess && (
                <div className="alert alert-success">{transferSuccess}</div>
              )}

              <form className="transfer-form" onSubmit={handleTransfer}>
                <div className="form-group">
                  <label htmlFor="transfer-search">Find user (name or email)</label>
                  <input
                    id="transfer-search"
                    type="text"
                    placeholder="e.g. john or john@email.com"
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
                            <span className="search-result-points">{u.points} pts</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="transfer-amount">Points to transfer</label>
                  <input
                    id="transfer-amount"
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 5"
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
                  {transferLoading ? 'Transferring…' : 'Transfer'}
                </button>
              </form>

              <h2 className="history-title">Transfer history</h2>
              {history.length === 0 ? (
                <p className="no-history">No transfers yet.</p>
              ) : (
                <ul className="transfer-history-list">
                  {history.map((item) => (
                    <li
                      key={item._id}
                      className={`transfer-history-item ${item.type}`}
                    >
                      <span className={`transfer-badge ${item.type}`}>
                        {item.type === 'sent' ? 'Sent' : 'Received'}
                      </span>
                      <span className="transfer-amount">
                        {item.type === 'sent' ? '−' : '+'}
                        {item.amount} pts
                      </span>
                      <span className="transfer-party">
                        {item.type === 'sent' ? 'to' : 'from'}{' '}
                        <strong>{item.otherUser?.name}</strong>
                      </span>
                      <span className="transfer-date">{formatDate(item.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default Profile;
