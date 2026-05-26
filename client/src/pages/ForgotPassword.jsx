import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { forgotPassword } from '../services/authService';
import getErrorMessage from '../utils/getErrorMessage';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setTempPassword('');
    setCopied(false);

    const payload = { email: email.trim(), phone: '' };
    if (!payload.email) {
      setError('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const data = await forgotPassword(payload);

      // Show password on screen if development mode and email not configured
      if (data.showPasswordOnScreen && data.generatedPassword) {
        setTempPassword(data.generatedPassword);
        setSuccessMessage(
          data.message ||
            `Password reset successful.\nYour temporary password is: ${data.generatedPassword}`
        );
      } else if (data.generatedPassword) {
        // Fallback: show password if it exists (shouldn't normally happen)
        setTempPassword(data.generatedPassword);
        setSuccessMessage(
          data.message ||
            `Password reset successful.\nYour temporary password is: ${data.generatedPassword}`
        );
      } else {
        // Normal flow: email was sent successfully
        setSuccessMessage(data.message);
      }
    } catch (err) {
      const msg = err.response?.data?.message;
      setError(msg || getErrorMessage(err, 'Could not reset your password.'));
    } finally {
      setLoading(false);
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
          <h1>Forgot Password</h1>
          <p className="auth-subtitle">
            Reset your password using your registered email. You can use this option only once per day.
          </p>
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
                {copied ? 'Copied!' : 'Copy password'}
              </button>
            </div>
            <p className="form-hint temp-password-hint">
              Use this password on the{' '}
              <Link to="/login">login page</Link>. Change it after signing in if you
              want.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="forgot-email">Registered Email</label>
            <input
              id="forgot-email"
              type="email"
              name="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={!!tempPassword}
            />
          </div>

          {!tempPassword && (
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Processing…' : 'Reset Password'}
            </button>
          )}
        </form>

        <p className="auth-footer">
          Remember your password? <Link to="/login">Back to Log In</Link>
        </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
