import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import API from '../services/api';
import { upvoteAnswer, downvoteAnswer } from '../services/answerService';
import getErrorMessage from '../utils/getErrorMessage';

const VoteButtons = ({
  targetType = 'answer',
  targetId,
  initialScore = 0,
  initialUserVote = null,
  onVoteChange,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [score, setScore] = useState(initialScore);
  const [userVote, setUserVote] = useState(initialUserVote);
  const [loading, setLoading] = useState(false);
  const [voteError, setVoteError] = useState('');

  useEffect(() => {
    setScore(initialScore);
    setUserVote(initialUserVote);
    setVoteError('');
  }, [initialScore, initialUserVote, targetId]);

  const redirectToLogin = (message) => {
    navigate('/login', {
      state: { message: message || t('vote.loginRequired', 'Please log in to vote.') },
    });
  };

  const applyResult = (data) => {
    const newScore = data.totalVotes ?? data.voteScore ?? score;
    setScore(newScore);
    setUserVote(data.userVote);
    setVoteError('');
    onVoteChange?.(newScore, data.userVote);
  };

  const handleVoteError = (err) => {
    const msg = getErrorMessage(err, t('vote.failed', 'Could not register your vote.'));
    setVoteError(msg);
    if (err.response?.status === 401) {
      redirectToLogin(t('vote.loginRequired', 'Please log in to vote.'));
    }
  };

  const handleQuestionVote = async (voteType) => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }
    setLoading(true);
    setVoteError('');
    try {
      const { data } = await API.post(`/questions/${targetId}/vote`, { voteType });
      applyResult(data);
    } catch (err) {
      handleVoteError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerUpvote = async () => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }
    setLoading(true);
    setVoteError('');
    try {
      const data = await upvoteAnswer(targetId);
      applyResult(data);
    } catch (err) {
      handleVoteError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerDownvote = async () => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }
    setLoading(true);
    setVoteError('');
    try {
      const data = await downvoteAnswer(targetId);
      applyResult(data);
    } catch (err) {
      handleVoteError(err);
    } finally {
      setLoading(false);
    }
  };

  const onUp = () =>
    targetType === 'question' ? handleQuestionVote('up') : handleAnswerUpvote();

  const onDown = () =>
    targetType === 'question' ? handleQuestionVote('down') : handleAnswerDownvote();

  return (
    <div className="vote-wrap">
      <div className={`vote-box ${loading ? 'vote-loading' : ''}`}>
        <button
          type="button"
          className={`vote-btn vote-up ${userVote === 'up' ? 'active' : ''}`}
          onClick={onUp}
          disabled={loading}
          aria-label={t('vote.upvote')}
          title={isAuthenticated ? t('vote.upvote') : t('vote.loginRequired', 'Please log in to vote.')}
        >
          ▲
        </button>
        <span className="vote-score" title={t('vote.totalVotes')}>
          {score}
        </span>
        <button
          type="button"
          className={`vote-btn vote-down ${userVote === 'down' ? 'active' : ''}`}
          onClick={onDown}
          disabled={loading}
          aria-label={t('vote.downvote')}
          title={isAuthenticated ? t('vote.downvote') : t('vote.loginRequired', 'Please log in to vote.')}
        >
          ▼
        </button>
      </div>
      {voteError && <p className="vote-error-msg">{voteError}</p>}
    </div>
  );
};

export default VoteButtons;
