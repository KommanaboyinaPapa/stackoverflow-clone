import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AnswerForm from '../components/AnswerForm';
import BackButton from '../components/BackButton';
import { useLanguage } from '../context/LanguageContext';
import VoteButtons from '../components/VoteButtons';
import { fetchQuestionById } from '../services/questionService';
import getErrorMessage from '../utils/getErrorMessage';

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  return `${days} days ago`;
};

const QuestionDetail = () => {
  const { t } = useLanguage();
  const { id } = useParams();
  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchQuestionById(id);
        setQuestion(data.question);
        setAnswers(data.answers || []);
      } catch (err) {
        setError(getErrorMessage(err, t('detail.failed')));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, t]);

  const handleAnswerPosted = (newAnswer) => {
    setAnswers((prev) => [...prev, newAnswer]);
    setQuestion((q) => ({
      ...q,
      answerCount: (q?.answerCount || 0) + 1,
    }));
  };

  const updateAnswerVote = (answerId, voteScore, userVote) => {
    setAnswers((prev) =>
      prev.map((a) =>
        a._id === answerId ? { ...a, voteScore, totalVotes: voteScore, userVote } : a
      )
    );
  };

  if (loading) {
    return (
      <div className="page detail-page">
        <div className="page-content">
          <div className="detail-loading">
            <div className="loading-spinner" />
            <p>{t('detail.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !question) {
    return (
      <div className="page detail-page">
        <div className="page-content">
          <BackButton />
          <div className="alert alert-error">{error || t('detail.notFound')}</div>
          <Link to="/questions" className="btn btn-outline">
            {t('detail.backList')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page detail-page">
      <div className="page-content">
        <BackButton />
        <article className="post-block question-post">
          <VoteButtons
            targetType="question"
            targetId={question._id}
            initialScore={question.voteScore ?? 0}
            initialUserVote={question.userVote}
            onVoteChange={(voteScore, userVote) =>
              setQuestion((q) => ({ ...q, voteScore, userVote }))
            }
          />
          <div className="post-content">
            <h1 className="detail-title">{question.title}</h1>
            <div className="post-meta">
              {t('detail.askedBy')} <strong>{question.user?.name || 'Anonymous'}</strong>
              <span className="meta-separator"> · </span>
              {timeAgo(question.createdAt)}
            </div>
            <div className="post-body">{question.description}</div>
            {question.tags?.length > 0 && (
              <div className="tag-list">
                {question.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <p className="vote-total-label">
              {t('detail.score')} <strong>{question.voteScore ?? 0}</strong> {t('questions.votes')}
            </p>
          </div>
        </article>

        <section className="answers-section">
          <h2>{t('detail.answersTitle', { count: answers.length })}</h2>

          {answers.length === 0 ? (
            <p className="no-answers">{t('detail.noAnswers')}</p>
          ) : (
            <ul className="answer-list">
              {answers.map((a) => (
                <li key={a._id} className="post-block answer-post">
                  <VoteButtons
                    targetType="answer"
                    targetId={a._id}
                    initialScore={a.voteScore ?? a.totalVotes ?? 0}
                    initialUserVote={a.userVote}
                    onVoteChange={(voteScore, userVote) =>
                      updateAnswerVote(a._id, voteScore, userVote)
                    }
                  />
                  <div className="post-content">
                    <div className="post-meta answer-meta">
                      {a.author?.profileImage && (
                        <img
                          src={a.author.profileImage}
                          alt={`${a.author?.name || 'User'} avatar`}
                          className="meta-avatar"
                        />
                      )}
                      <span>
                        {a.author?.name || 'Anonymous'} · {timeAgo(a.createdAt)}
                      </span>
                      <span className="answer-vote-total">
                        {a.voteScore ?? 0} votes
                      </span>
                    </div>
                    <div className="post-body">{a.body}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <AnswerForm questionId={id} onAnswerPosted={handleAnswerPosted} />
        </section>
      </div>
    </div>
  );
};

export default QuestionDetail;
