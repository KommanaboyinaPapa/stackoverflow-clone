import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createAnswer } from '../services/answerService';
import getErrorMessage from '../utils/getErrorMessage';
import LoginPrompt from './LoginPrompt';

/**
 * Protected answer form — only logged-in users can submit.
 */
const AnswerForm = ({ questionId, onAnswerPosted }) => {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [answerBody, setAnswerBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) {
    return <div className="profile-loading">Checking login…</div>;
  }

  if (!isAuthenticated) {
    return (
      <LoginPrompt message="Please log in to post an answer to this question." />
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!answerBody.trim()) {
      setError('Please write your answer before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await createAnswer({
        questionId,
        body: answerBody.trim(),
      });
      setAnswerBody('');
      onAnswerPosted?.(data.answer);
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to post your answer.');
      setError(msg);
      if (err.response?.status === 401) {
        navigate('/login', {
          replace: true,
          state: { message: 'Your session expired. Please log in again.' },
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="your-answer">
      <h3>Your Answer</h3>
      <p className="form-hint">Share your solution or explanation below.</p>
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <textarea
          className="answer-textarea"
          rows="8"
          placeholder="Write your answer here…"
          value={answerBody}
          onChange={(e) => setAnswerBody(e.target.value)}
          disabled={submitting}
        />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Posting…' : 'Post Your Answer'}
        </button>
      </form>
    </div>
  );
};

export default AnswerForm;
