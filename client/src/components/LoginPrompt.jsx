import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Shown when a logged-out user tries to use a protected action (e.g. post answer).
 */
const LoginPrompt = ({ message = 'You need to be logged in to do this.' }) => {
  return (
    <div className="login-prompt">
      <p>{message}</p>
      <div className="login-prompt-actions">
        <Link to="/login" className="btn btn-primary">
          Log In
        </Link>
        <Link to="/register" className="btn btn-outline">
          Create Account
        </Link>
      </div>
    </div>
  );
};

export default LoginPrompt;
