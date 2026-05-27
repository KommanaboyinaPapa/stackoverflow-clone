import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { fetchQuestions } from '../services/questionService';
import getErrorMessage from '../utils/getErrorMessage';

const timeAgo = (dateStr, t) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return t('questions.minutesAgo', '{{count}}m ago', { count: mins || 1 });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t('questions.hoursAgo', '{{count}}h ago', { count: hrs });
  const days = Math.floor(hrs / 24);
  return t('questions.daysAgo', '{{count}}d ago', { count: days });
};

const Questions = () => {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('newest');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await fetchQuestions({ sort, search });
        setQuestions(data.questions);
      } catch (err) {
        setError(getErrorMessage(err, t('questions.failed')));
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [sort, search, t]);

  return (
    <div className="page questions-page">
      <div className="questions-header">
        <div>
          <h1>{t('questions.title')}</h1>
          <p className="questions-subtitle">
            {loading
              ? t('questions.loading')
              : t('questions.count', { count: questions.length })}
          </p>
        </div>
        <Link to="/ask" className="btn btn-primary">
          {t('questions.askBtn')}
        </Link>
      </div>

      <div className="questions-toolbar">
        <input
          type="search"
          className="search-input"
          placeholder={t('questions.search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search questions"
        />
        <div className="sort-tabs">
          <button
            type="button"
            className={`sort-tab ${sort === 'newest' ? 'active' : ''}`}
            onClick={() => setSort('newest')}
          >
            {t('questions.newest')}
          </button>
          <button
            type="button"
            className={`sort-tab ${sort === 'votes' ? 'active' : ''}`}
            onClick={() => setSort('votes')}
          >
            {t('questions.topVoted')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="questions-loading">
          <div className="loading-spinner" />
          <p>{t('questions.loading')}</p>
        </div>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>{t('questions.empty')}</p>
          <Link to="/ask" className="btn btn-outline">
            {t('questions.emptyBtn')}
          </Link>
        </div>
      ) : (
        <ul className="question-list">
          {questions.map((q) => (
            <li key={q._id} className="question-card">
              <Link to={`/questions/${q._id}`} className="question-card-link">
                <div className="question-stats">
                  <div className="stat-block">
                    <span className="stat-num">{q.voteScore ?? 0}</span>
                    <span className="stat-label">{t('questions.votes')}</span>
                  </div>
                  <div
                    className={`stat-block ${q.answerCount > 0 ? 'has-answers' : ''}`}
                  >
                    <span className="stat-num">{q.answerCount ?? 0}</span>
                    <span className="stat-label">{t('questions.answers')}</span>
                  </div>
                </div>
                <div className="question-summary">
                  <h3 className="question-title">
                    {q.title}
                  </h3>
                  <p className="question-excerpt">
                    {q.description?.length > 160
                      ? `${q.description.slice(0, 160)}…`
                      : q.description}
                  </p>
                  <div className="question-meta">
                    <div className="question-tags">
                      {q.tags?.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="question-meta-row">
                      {q.user?.profileImage && (
                        <img
                          src={q.user.profileImage}
                          alt={`${q.user?.name || 'User'} avatar`}
                          className="meta-avatar"
                        />
                      )}
                      <span className="meta-author">
                        {q.user?.name || 'Anonymous'}
                      </span>
                      <span className="meta-time">{t('questions.asked')} {timeAgo(q.createdAt, t)}</span>
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Questions;
