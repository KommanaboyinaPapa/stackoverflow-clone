import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import getErrorMessage from '../utils/getErrorMessage';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const validateForm = () => {
    if (!formData.name.trim()) return t('auth.nameRequired');
    if (!formData.email.trim()) return t('auth.emailRequired');
    if (!/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      return t('auth.emailInvalid');
    }
    if (formData.password.length < 8) {
      return t('auth.passwordTooShort');
    }
    if (formData.password !== formData.confirmPassword) {
      return t('auth.passwordMismatch');
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const data = await register({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        phone: formData.phone.trim(),
      });
      setSuccess(t('auth.accountCreated', { name: data.user.name }));
      setTimeout(() => navigate('/'), 800);
    } catch (err) {
      setError(getErrorMessage(err, t('auth.registerFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <div className="auth-card auth-card-glow">
        <div className="auth-header">
          <span className="auth-icon">✨</span>
          <h1>{t('auth.registerTitle')}</h1>
          <p className="auth-subtitle">{t('auth.registerSub')}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="register-name">{t('auth.name')}</label>
            <input
              id="register-name"
              type="text"
              name="name"
              placeholder={t('auth.namePlaceholder')}
              value={formData.name}
              onChange={handleChange}
              autoComplete="name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-email">{t('auth.email')}</label>
            <input
              id="register-email"
              type="email"
              name="email"
              placeholder={t('auth.emailPlaceholder')}
              value={formData.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-password">{t('auth.password')}</label>
            <input
              id="register-password"
              type="password"
              name="password"
              placeholder={t('auth.passwordPlaceholder')}
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-phone">{t('auth.phone')}</label>
            <input
              id="register-phone"
              type="tel"
              name="phone"
              placeholder={t('auth.phonePlaceholder')}
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="register-confirm">{t('auth.confirmPassword')}</label>
            <input
              id="register-confirm"
              type="password"
              name="confirmPassword"
              placeholder={t('auth.confirmPasswordPlaceholder')}
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? t('auth.registering') : t('auth.registerBtn')}
          </button>
        </form>

        <p className="auth-footer">
          {t('auth.hasAccount')} <Link to="/login">{t('auth.loginLink')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;