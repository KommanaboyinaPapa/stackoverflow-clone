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
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [smsNotSent, setSmsNotSent] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setTempPassword('');
    setSessionKey('');
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
      setSessionKey(data.sessionKey || '');
+      // Phone flow: server will send OTP and return otpSent=true (no generatedPassword yet)
+      if (data.otpSent) {
+        setOtpSent(true);
+        setSuccessMessage(data.message || t('forgot.otpSent'));
+        setTempPassword('');
+        setSmsNotSent(false);
+        return;
+      }
+      // Email flow continues to return generatedPassword immediately for UI.
      setTempPassword(data.generatedPassword || '');
      setSmsNotSent(false);
      setSuccessMessage(data.message || t('forgot.tempGenerated'));
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
      const payload = {
        sessionKey,
        confirm: true,
        generatedPassword: tempPassword,
      };

      const data = await confirmForgotPassword(payload);
      setSuccessMessage(data.message || t('forgot.confirmSuccess'));

      if (data.generatedPassword) {
        setTempPassword(data.generatedPassword);
      }
      setSmsNotSent(!!data.smsNotSent);

      setSessionKey('');
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, t('forgot.confirmFailed')));
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!sessionKey || !otp) return;
    setError('');
    setVerifyingOtp(true);
    try {
      const { verifyForgotPasswordOtp } = await import('../services/authService');
      const data = await verifyForgotPasswordOtp({ sessionKey, otp });
      setTempPassword(data.generatedPassword || '');
      setSuccessMessage(data.message || t('forgot.tempGenerated'));
      setOtpSent(false);
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, t('forgot.otpFailed')));
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleCancel = () => {
    setError('');
    setSuccessMessage('');
    setTempPassword('');
    setSessionKey('');
    setLoading(false);
    setConfirmLoading(false);
    setCopied(false);
    setMethod('email');
    setEmail('');
    setPhone('');
    setSmsNotSent(false);
    setOtp('');
    setOtpSent(false);
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
            {smsNotSent && (
              <div className="alert alert-warning">
                SMS sender number is not configured, so please copy the generated password shown on screen.
              </div>
            )}
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
              disabled={!!tempPassword || otpSent}
            />
          </div>

          {!tempPassword && !otpSent && (
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? t('forgot.submitting') : t('forgot.submit')}
            </button>
          )}

+          {otpSent && !tempPassword && (
+            <div className="otp-panel">
+              <div className="form-group">
+                <label htmlFor="forgot-otp">{t('forgot.otpLabel') || 'Enter OTP'}</label>
+                <input
+                  id="forgot-otp"
+                  type="text"
+                  value={otp}
+                  onChange={(e) => setOtp(e.target.value)}
+                  placeholder={t('forgot.otpPlaceholder') || '123456'}
+                />
+              </div>
+              <div className="temp-password-actions">
+                <button
+                  type="button"
+                  className="btn btn-primary"
+                  onClick={handleVerifyOtp}
+                  disabled={verifyingOtp || !otp}
+                >
+                  {verifyingOtp ? t('forgot.verifying') : t('forgot.verifyOtp')}
+                </button>
+                <button type="button" className="btn btn-outline" onClick={handleCancel}>
+                  {t('common.cancel')}
+                </button>
+              </div>
+            </div>
+          )}
*** End Patch
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
