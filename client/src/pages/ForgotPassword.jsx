import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useLanguage } from '../context/LanguageContext';
import {
  cancelForgotPassword,
  finalizeForgotPassword,
  requestForgotPasswordOtp,
  verifyForgotPasswordOtp,
} from '../services/authService';
import getErrorMessage from '../utils/getErrorMessage';

const ForgotPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState('email');
  const [step, setStep] = useState('request'); // request | verify | password | done
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [sessionKey, setSessionKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');
  const [demoNote, setDemoNote] = useState('');

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setGeneratedPassword('');
    setPasswordInput('');
    setSessionKey('');
    setOtp('');
    setDemoOtp('');
    setDemoNote('');
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
      const data = await requestForgotPasswordOtp(payload);
      setSessionKey(data.sessionKey || '');
      setSuccessMessage(data.message || t('forgot.otpSent') || 'OTP sent.');
      if (data.showDemoOtp) {
        setDemoOtp(data.showDemoOtp);
        setDemoNote(data.demoNote || '');
      }
      setStep('verify');
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, t('forgot.resetFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!sessionKey) return;
    setError('');
    setSuccessMessage('');
    setGeneratedPassword('');
    setPasswordInput('');
    setOtpLoading(true);
    try {
      const data = await verifyForgotPasswordOtp({ sessionKey, otp: otp.trim() });
      setGeneratedPassword(data.generatedPassword || '');
      setPasswordInput(data.generatedPassword || '');
      setSuccessMessage(data.message || t('forgot.otpVerified') || 'OTP verified.');
      setStep('password');
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, t('forgot.confirmFailed')));
    } finally {
      setOtpLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!sessionKey) return;
    setError('');
    setSuccessMessage('');
    setFinalizeLoading(true);
    try {
      const data = await finalizeForgotPassword({
        sessionKey,
        password: passwordInput,
      });
      setSuccessMessage(data.message || t('forgot.confirmSuccess'));
      setStep('done');
      // Keep state minimal after completion.
      setSessionKey('');
      setOtp('');
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, t('forgot.confirmFailed')));
    } finally {
      setFinalizeLoading(false);
    }
  };

  const resetLocalState = () => {
    setError('');
    setSuccessMessage('');
    setGeneratedPassword('');
    setPasswordInput('');
    setSessionKey('');
    setOtp('');
    setDemoOtp('');
    setDemoNote('');
    setLoading(false);
    setOtpLoading(false);
    setFinalizeLoading(false);
    setCopied(false);
    setMethod('email');
    setEmail('');
    setPhone('');
    setStep('request');
  };

  const handleCancel = async () => {
    setError('');
    setSuccessMessage('');
    try {
      if (sessionKey) {
        await cancelForgotPassword({ sessionKey });
      }
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, t('forgot.cancelFailed')));
      // Still reset local UI; cancel is best-effort.
    } finally {
      resetLocalState();
    }
  };

  const handleCopy = async () => {
    if (!passwordInput) return;
    try {
      await navigator.clipboard.writeText(passwordInput);
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

        {/* Avoid duplicate success alerts: step=done has its own success banner below */}
        {successMessage && step !== 'password' && step !== 'done' && (
          <div className="alert alert-success">{successMessage}</div>
        )}

        {step === 'password' && (
          <div className="temp-password-panel" role="status">
            <p className="temp-password-message">{successMessage}</p>
            <div className="temp-password-display">
              <code className="temp-password-code">{generatedPassword}</code>
              <button
                type="button"
                className="btn btn-outline btn-copy"
                onClick={handleCopy}
              >
                {copied ? t('forgot.copied') : t('forgot.copy')}
              </button>
            </div>
            <div className="form-group">
              <label htmlFor="forgot-new-password">
                {t('forgot.customPasswordLabel') || 'Use this password or enter your own'}
              </label>
              <input
                id="forgot-new-password"
                type="text"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
              <small className="form-hint">
                {t('forgot.passwordEditHint') || 'You can edit this password before confirming.'}
              </small>
            </div>
            <div className="temp-password-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleFinalize}
                disabled={finalizeLoading || !passwordInput}
              >
                {finalizeLoading
                  ? t('forgot.submitting')
                  : t('forgot.accept') || t('forgot.confirmSend') || 'Accept & update'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleCancel}
                disabled={finalizeLoading}
              >
                {t('forgot.reject') || t('common.cancel')}
              </button>
            </div>
            <p className="form-hint temp-password-hint">
              {t('forgot.tempPasswordHintStart')}{' '}
              <Link to="/login">{t('auth.loginBtn')}</Link>{' '}
              {t('forgot.tempPasswordHintEnd')}
            </p>
          </div>
        )}

        {step === 'request' && (
          <form onSubmit={handleRequestOtp} className="auth-form" noValidate>
            <div className="forgot-method-tabs">
              <button
                type="button"
                className={`forgot-tab ${method === 'email' ? 'active' : ''}`}
                onClick={() => setMethod('email')}
              >
                {t('forgot.emailTab')}
              </button>
              <button
                type="button"
                className={`forgot-tab ${method === 'phone' ? 'active' : ''}`}
                onClick={() => setMethod('phone')}
              >
                {t('forgot.phoneTab')}
              </button>
            </div>
            <div className="form-group">
              <label htmlFor="forgot-identifier">
                {method === 'email' ? t('forgot.emailLabel') : t('forgot.phoneLabel')}
              </label>
              <input
                id="forgot-identifier"
                type={method === 'email' ? 'email' : 'tel'}
                name={method === 'email' ? 'email' : 'phone'}
                placeholder={
                  method === 'email' ? t('forgot.emailPlaceholder') : t('forgot.phonePlaceholder')
                }
                value={method === 'email' ? email : phone}
                onChange={(e) => (method === 'email' ? setEmail(e.target.value) : setPhone(e.target.value))}
                autoComplete={method === 'email' ? 'email' : 'tel'}
              />
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? t('forgot.submitting') : t('forgot.sendOtp') || 'Send OTP'}
            </button>
          </form>
        )}

        {step === 'verify' && (
          <div className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="forgot-otp">{t('forgot.otpLabel') || 'OTP'}</label>
              <input
                id="forgot-otp"
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder={t('forgot.otpPlaceholder') || 'Enter the 6-digit code'}
                autoComplete="one-time-code"
              />
              {demoOtp && (
                <small className="form-hint">
                  {demoNote || t('forgot.demoOtpNote') || 'Development mode: OTP shown here.'}{' '}
                  <strong>{demoOtp}</strong>
                </small>
              )}
            </div>
            <div className="temp-password-actions">
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={handleVerifyOtp}
                disabled={otpLoading || !otp.trim()}
              >
                {otpLoading ? t('forgot.submitting') : t('forgot.verifyOtp') || 'Verify OTP'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-block"
                onClick={handleCancel}
                disabled={otpLoading}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="alert alert-success">
            {successMessage || t('forgot.confirmSuccess')}
          </div>
        )}

        <p className="auth-footer">
          {t('forgot.rememberPassword')} <Link to="/login">{t('forgot.backLogin')}</Link>
        </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
