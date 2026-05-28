import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LANGUAGE_OPTIONS } from '../i18n/translations';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { updatePhone } from '../services/authService';
import { sendLanguageOtp, verifyLanguageOtp } from '../services/languageService';
import getErrorMessage from '../utils/getErrorMessage';

const LanguageOtpModal = () => {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const {
    otpModal,
    closeOtpModal,
    completeLanguageChange,
    openOtpModal,
    setPendingLanguage,
    t,
  } = useLanguage();

  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('send');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [demoOtp, setDemoOtp] = useState('');
  const [meta, setMeta] = useState(null);

  const targetLanguage = otpModal?.targetLanguage;
  const mode = otpModal?.mode || 'otp';
  const langLabel =
    LANGUAGE_OPTIONS.find((l) => l.code === targetLanguage)?.native || targetLanguage;
  const isFrench = targetLanguage === 'fr';
  const autoSentRef = useRef(false);

  const sendOtpFlow = useCallback(async () => {
    if (!targetLanguage) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const data = await sendLanguageOtp(targetLanguage);
      setMeta(data);
      setDemoOtp(data.demoOtp || '');
      setSuccess(data.message || t('language.resent'));
      setStep('verify');
    } catch (err) {
      if (err.response?.data?.code === 'PHONE_REQUIRED') {
        openOtpModal(targetLanguage, 'phone-required');
      } else {
        setError(getErrorMessage(err, t('common.error')));
      }
    } finally {
      setLoading(false);
    }
  }, [targetLanguage, openOtpModal, t]);

  useEffect(() => {
    if (otpModal) {
      setOtp('');
      setStep('send');
      setPhone(user?.phone || '');
      setError('');
      setSuccess('');
      setDemoOtp('');
      setMeta(null);
      if (!otpModal.resumeOtp) {
        autoSentRef.current = false;
      }
    } else {
      autoSentRef.current = false;
    }
  }, [otpModal?.targetLanguage, otpModal?.mode, user?.phone, otpModal?.resumeOtp, otpModal]);

  useEffect(() => {
    if (
      otpModal?.resumeOtp &&
      otpModal.mode === 'otp' &&
      targetLanguage &&
      !autoSentRef.current
    ) {
      autoSentRef.current = true;
      sendOtpFlow();
    }
  }, [otpModal?.resumeOtp, otpModal?.mode, targetLanguage, sendOtpFlow, otpModal]);

  if (!otpModal) return null;

  const handleSendOtp = () => {
    console.log('FRONTEND SEND OTP CLICKED');
    sendOtpFlow();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await verifyLanguageOtp({
        language: targetLanguage,
        otp: otp.trim(),
      });
      setSuccess(data.message);
      await completeLanguageChange(targetLanguage);
    } catch (err) {
      setError(getErrorMessage(err, t('common.error')));
    } finally {
      setLoading(false);
    }
  };

  const handleSavePhoneInline = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await updatePhone(phone.trim());
      await refreshUser();
      setSuccess(t('language.mobileSaved'));
      openOtpModal(targetLanguage, 'otp', { resumeOtp: true });
    } catch (err) {
      setError(getErrorMessage(err, t('common.error')));
    } finally {
      setLoading(false);
    }
  };

  const handleGoToProfile = () => {
    setPendingLanguage(targetLanguage);
    closeOtpModal();
    navigate('/profile', {
      state: { focusPhone: true, pendingLanguage: targetLanguage },
    });
  };

  const handleAddMobileClick = () => {
    openOtpModal(targetLanguage, 'phone-inline');
  };

  if (mode === 'phone-required') {
    return (
      <div className="lang-modal-overlay" role="dialog" aria-modal="true">
        <div className="lang-modal lang-modal-phone-required">
          <button
            type="button"
            className="lang-modal-close"
            onClick={closeOtpModal}
            aria-label={t('common.close', 'Close')}
          >
            ×
          </button>
          <div className="lang-phone-icon" aria-hidden="true">
            📱
          </div>
          <h2>{t('language.phoneRequiredTitle')}</h2>
          <p className="lang-modal-subtitle">{t('language.phoneRequiredDesc')}</p>
          <p className="lang-modal-channel">
            {t('language.changeHint')} <strong>{langLabel}</strong>
          </p>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="lang-modal-actions lang-modal-actions-stack">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddMobileClick}
            >
              {t('language.addMobileBtn')}
            </button>
            <button type="button" className="btn btn-outline" onClick={handleGoToProfile}>
              {t('language.goToProfileBtn')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={closeOtpModal}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'phone-inline') {
    return (
      <div className="lang-modal-overlay" role="dialog" aria-modal="true">
        <div className="lang-modal">
          <button
            type="button"
            className="lang-modal-close"
            onClick={closeOtpModal}
            aria-label={t('common.close', 'Close')}
          >
            ×
          </button>
          <h2>{t('language.addMobileBtn')}</h2>
          <p className="lang-modal-subtitle">{t('language.profilePhoneHint')}</p>
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}
          <form onSubmit={handleSavePhoneInline} className="lang-phone-form">
            <div className="form-group">
              <label htmlFor="lang-modal-phone">{t('language.mobileLabel')}</label>
              <input
                id="lang-modal-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('language.mobilePlaceholder')}
                disabled={loading}
                autoFocus
                required
              />
            </div>
            <div className="lang-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => openOtpModal(targetLanguage, 'phone-required')}
                disabled={loading}
              >
                {t('common.back')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? t('common.loading') : t('language.saveMobile')}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="lang-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="lang-modal-title">
      <div className="lang-modal">
        <button
          type="button"
          className="lang-modal-close"
          onClick={closeOtpModal}
          aria-label={t('common.close', 'Close')}
        >
          ×
        </button>
        <h2 id="lang-modal-title">{t('language.changeTitle')}</h2>
        <p className="lang-modal-subtitle">
          {t('language.changeHint')}{' '}
          <strong>{langLabel}</strong>
        </p>
        <p className="lang-modal-channel">
          {isFrench ? t('language.emailOtp') : t('language.mobileOtp')}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {demoOtp && (
          <div className="lang-demo-otp">
            <span className="lang-demo-label">{t('language.demoOtp')}:</span>
            <code>{demoOtp}</code>
          </div>
        )}

        {meta?.destinationMasked && (
          <p className="form-hint">
            {t('language.sentTo', 'Sent to:')} {meta.destinationMasked}
          </p>
        )}

        {step === 'send' ? (
          <div className="lang-modal-actions">
            <button type="button" className="btn btn-outline" onClick={closeOtpModal}>
              {t('common.cancel')}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSendOtp}
              disabled={loading}
            >
              {loading ? t('common.loading') : t('language.sendOtp')}
            </button>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="lang-otp-form">
            <div className="form-group">
              <label htmlFor="lang-otp-input">{t('language.otpPlaceholder')}</label>
              <input
                id="lang-otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder={t('language.otpExample', '000000')}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                disabled={loading}
                autoFocus
              />
            </div>
            <div className="lang-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setStep('send')}
                disabled={loading}
              >
                {t('language.sendOtp')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading || otp.length < 6}>
                {loading ? t('common.loading') : t('language.verify')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LanguageOtpModal;
