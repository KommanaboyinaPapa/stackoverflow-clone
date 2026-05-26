import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import LoginDeviceOtpModal from '../components/LoginDeviceOtpModal';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import getErrorMessage from '../utils/getErrorMessage';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, completeLogin, isAuthenticated, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingSession, setPendingSession] = useState(null);

  const redirectTo = location.state?.from || '/';

  useEffect(() => {
    if (location.state?.message) {
      setInfo(location.state.message);
    }
  }, [location.state]);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirectTo, { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate, redirectTo]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInfo('');

    if (!formData.email.trim() || !formData.password) {
      setError(`${t('auth.email')} & ${t('auth.password')} required.`);
      return;
    }

    setLoading(true);
    try {
      const data = await login({
        email: formData.email.trim(),
        password: formData.password,
      });
      if (data.requiresDeviceVerification) {
        setPendingSession(data);
        return;
      }
      setSuccess(t('auth.welcome', { name: data.user.name }));
      setTimeout(() => navigate(redirectTo, { replace: true }), 800);
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        getErrorMessage(err, t('auth.loginFailed'));
      setError(msg);
      if (err.response?.data?.mobileLoginWindow) {
        setInfo(err.response.data.mobileLoginWindow.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceVerified = (data) => {
    setPendingSession(null);
    completeLogin(data);
    setSuccess(t('auth.welcome', { name: data.user.name }));
    setTimeout(() => navigate(redirectTo, { replace: true }), 800);
  };

  return (
    <>
    <LoginDeviceOtpModal
      open={!!pendingSession}
      pendingSession={pendingSession}
      onSuccess={handleDeviceVerified}
      onCancel={() => setPendingSession(null)}
      t={t}
    />
    <div className="page auth-page">
      <div className="auth-card auth-card-glow">
        <div className="auth-header">
          <span className="auth-icon">🔐</span>
          <h1>{t('auth.loginTitle')}</h1>
          <p className="auth-subtitle">{t('auth.loginSub')}</p>
        </div>

        {info && <div className="alert alert-info">{info}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="login-email">{t('auth.email')}</label>
            <input
              id="login-email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <div className="label-row">
              <label htmlFor="login-password">{t('auth.password')}</label>
              <Link to="/forgot-password" className="forgot-link">
                {t('auth.forgot')}
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? t('auth.loggingIn') : t('auth.loginBtn')}
          </button>
        </form>

        <p className="auth-footer">
          {t('auth.noAccount')} <Link to="/register">{t('auth.signUp')}</Link>
        </p>
      </div>
    </div>
    </>
  );
};

export default Login;
