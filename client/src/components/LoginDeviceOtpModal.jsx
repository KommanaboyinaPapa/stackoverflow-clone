import React, { useState } from 'react';
import { verifyDeviceLogin } from '../services/authService';

const LoginDeviceOtpModal = ({
  open,
  pendingSession,
  onSuccess,
  onCancel,
  t = (k) => k,
}) => {
  const [otp, setOtp] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open || !pendingSession) return null;

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await verifyDeviceLogin({
        pendingSessionId: pendingSession.pendingSessionId,
        otp: otp.trim(),
        trustDevice,
      });
      onSuccess?.(data);
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || 'Verification failed.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-security-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-security-title"
    >
      <div className="login-security-modal">
        <button
          type="button"
          className="lang-modal-close"
          onClick={onCancel}
          aria-label="Close"
        >
          ×
        </button>
        <div className="login-security-icon" aria-hidden="true">
          🛡️
        </div>
        <h2 id="login-security-title">
          {t('loginSecurity.title') || 'Verify new device'}
        </h2>
        <p className="login-security-desc">
          {t('loginSecurity.desc') ||
            'We detected a sign-in from a new browser or device. Enter the one-time code to continue.'}
        </p>
        {pendingSession.demoForced && (
          <div className="alert alert-info">{t('auth.demoVerify', 'Demo: Verify New Device')}</div>
        )}
        {pendingSession.deviceLabel && (
          <p className="login-security-device">
            <strong>{pendingSession.deviceLabel}</strong>
          </p>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {pendingSession.demoOtp && (
          <div className="lang-demo-otp">
            <span className="lang-demo-label">
              {t('language.demoOtp') || 'Demo OTP'}:
            </span>
            <code>{pendingSession.demoOtp}</code>
          </div>
        )}

        <form onSubmit={handleVerify} className="login-security-form">
          <div className="form-group">
            <label htmlFor="device-login-otp">
              {t('language.otpPlaceholder') || 'Enter 6-digit OTP'}
            </label>
            <input
              id="device-login-otp"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              disabled={loading}
              autoFocus
              required
            />
          </div>
          <label className="login-trust-checkbox">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              disabled={loading}
            />
            <span>
              {t('loginSecurity.trustDevice') ||
                'Trust this device — skip verification next time'}
            </span>
          </label>
          <div className="lang-modal-actions">
            <button type="button" className="btn btn-outline" onClick={onCancel} disabled={loading}>
              {t('common.cancel') || 'Cancel'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || otp.length < 6}
            >
              {loading
                ? t('common.loading') || 'Loading…'
                : t('loginSecurity.verify') || 'Verify & sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginDeviceOtpModal;
