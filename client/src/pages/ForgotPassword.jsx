import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useLanguage } from '../context/LanguageContext';
import { confirmForgotPassword, forgotPassword } from '../services/authService';
import getErrorMessage from '../utils/getErrorMessage';

const ForgotPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('email');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [otp, setOtp] = useState('');
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setTempPassword('');
    setSessionKey('');
    setOtp('');
    setRequiresOtp(false);
    setCopied(false);

    const payload = {
      email: method === 'email' ? email.trim() : '',
      phone: method === 'phone' ? phone.trim() : '',
    };
    if (!payload.email && !payload.phone) {
      setError(
        method === 'email'
          ? t('forgot.emailRequired')
          : t('forgot.phoneRequired')
      );
      return;
    }

    setLoading(true);
    try {
      const data = await forgotPassword(payload);

      if (data.generatedPassword) {
        setTempPassword(data.generatedPassword);
        setSessionKey(data.sessionKey || '');
      }

      if (data.requiresOtp) {
        setSessionKey(data.sessionKey || '');
        setRequiresOtp(true);
        setSuccessMessage(data.message || 'OTP sent. Please enter the code to continue.');
      } else {
        setSuccessMessage(data.message || t('forgot.tempGenerated'));
      }
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, t('forgot.resetFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSend = async () => {
    if (!sessionKey) return;
    setError('');
    setSuccessMessage('');
    setConfirmLoading(true);
    try {
      const payload = { sessionKey, confirm: true };
      if (requiresOtp) {
        if (!otp.trim()) {
          setError('Please enter the OTP sent to your phone.');
          return;
        }
        payload.otp = otp.trim();
      } else {
        if (!tempPassword) return;
        payload.generatedPassword = tempPassword;
      }

      const data = await confirmForgotPassword(payload);
      setSuccessMessage(data.message || t('forgot.confirmSuccess'));

      if (data.generatedPassword) {
        setTempPassword(data.generatedPassword);
      }

      setSessionKey('');
      setOtp('');
      setRequiresOtp(false);
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, t('forgot.confirmFailed')));
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!sessionKey) {
      setTempPassword('');
      setSuccessMessage('');
      setOtp('');
      setRequiresOtp(false);
      return;
    }
    setError('');
    setConfirmLoading(true);
    try {
      const data = await confirmForgotPassword({ sessionKey, confirm: false });
      setSuccessMessage(data.message || 'Password reset cancelled.');
      setTempPassword('');
      setSessionKey('');
      setOtp('');
      setRequiresOtp(false);
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, t('forgot.cancelFailed')));
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="page auth-page">
      <div className="page-content">
        <BackButton />
        <div className="auth-card auth-card-glow">
        <div className="auth-header">
          <span className="auth-icon">🔑</span>
          <h1>{t('forgot.title')}</h1>
          <p className="auth-subtitle">{t('forgot.subtitle')}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {successMessage && !tempPassword && (
          <div className="alert alert-success">{successMessage}</div>
        )}

        {tempPassword && (
          <div className="temp-password-panel" role="status">
            <p className="temp-password-message">{successMessage}</p>
            <div className="temp-password-display">
              <code className="temp-password-code">{tempPassword}</code>
              <button
                type="button"
                className="btn btn-outline btn-copy"
                onClick={handleCopy}
              >
                {copied ? t('forgot.copied') : t('forgot.copy')}
              </button>
            </div>
            <div className="temp-password-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmSend}
                disabled={confirmLoading || !sessionKey}
              >
                {confirmLoading ? t('forgot.submitting') : t('forgot.confirmSend')}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCancel}
                disabled={confirmLoading || !sessionKey}
              >
                {t('common.cancel')}
              </button>
            </div>
            <p className="form-hint temp-password-hint">
              {t('forgot.tempPasswordHintStart')}{' '}
              <Link to="/login">{t('auth.loginBtn')}</Link>{' '}
              {t('forgot.tempPasswordHintEnd')}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="forgot-method-tabs">
            <button
              type="button"
              className={`forgot-tab ${method === 'email' ? 'active' : ''}`}
              onClick={() => setMethod('email')}
              disabled={!!tempPassword}
            >
              {t('forgot.emailTab')}
            </button>
            <button
              type="button"
              className={`forgot-tab ${method === 'phone' ? 'active' : ''}`}
              onClick={() => setMethod('phone')}
              disabled={!!tempPassword}
            >
              {t('forgot.phoneTab')}
            </button>
          </div>
          <div className="form-group">
            <label htmlFor="forgot-email">
              {method === 'email'
                ? t('forgot.emailLabel')
                : t('forgot.phoneLabel')}
            </label>
            <input
              id="forgot-email"
              type={method === 'email' ? 'email' : 'tel'}
              name={method === 'email' ? 'email' : 'phone'}
              placeholder={
                method === 'email'
                  ? t('forgot.emailPlaceholder')
                  : t('forgot.phonePlaceholder')
              }
              value={method === 'email' ? email : phone}
              onChange={(e) =>
                method === 'email' ? setEmail(e.target.value) : setPhone(e.target.value)
              }
              autoComplete={method === 'email' ? 'email' : 'tel'}
              disabled={!!tempPassword || requiresOtp}
            />
          </div>

          {requiresOtp && !tempPassword && (
            <div className="form-group">
              <label htmlFor="forgot-otp">OTP code</label>
              <input
                id="forgot-otp"
                type="text"
                name="otp"
                placeholder={t('otpPlaceholder')}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                autoComplete="one-time-code"
              />
            </div>
          )}

          {!tempPassword && !requiresOtp && (
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? t('forgot.submitting') : t('forgot.submit')}
            </button>
          )}

          {requiresOtp && !tempPassword && (
            <div className="temp-password-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmSend}
                disabled={confirmLoading || !otp.trim()}
              >
                {confirmLoading ? t('forgot.submitting') : t('forgot.confirmSend')}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCancel}
                disabled={confirmLoading}
              >
                {t('common.cancel')}
              </button>
            </div>
          )}
        </form>

        <p className="auth-footer">
          {t('forgot.rememberPassword')} <Link to="/login">{t('forgot.backLogin')}</Link>
        </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
