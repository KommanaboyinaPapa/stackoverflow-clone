import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../components/BackButton';
import { useLanguage } from '../context/LanguageContext';
import { createQuestion } from '../services/questionService';
import { fetchMySubscription } from '../services/subscriptionService';
import getErrorMessage from '../utils/getErrorMessage';

const AskQuestion = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    tags: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    const loadQuota = async () => {
      try {
        const data = await fetchMySubscription();
        setQuota(data.quota);
      } catch {
        setQuota(null);
      }
    };
    loadQuota();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      setError(t('ask.required'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const tags = formData.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const data = await createQuestion({
        title: formData.title.trim(),
        description: formData.description.trim(),
        tags,
      });

      navigate(`/questions/${data.question._id}`);
    } catch (err) {
      setError(getErrorMessage(err, t('ask.failed')));
      if (err.response?.data?.quota) {
        setQuota(err.response.data.quota);
      }
      if (err.response?.status === 401) {
        navigate('/login', {
          state: { from: '/ask', message: t('ask.loginRequired', 'Please log in to ask a question.') },
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page ask-page">
      <div className="page-content">
        <BackButton />
        <div className="ask-card ask-card-enhanced">
        <div className="ask-header">
          <span className="ask-icon">❓</span>
          <h1>{t('ask.title')}</h1>
          <p className="ask-subtitle">{t('ask.subtitle')}</p>
        </div>

        {quota && (
          <div className="subscription-status-bar ask-quota-bar">
            <span>
              {t('ask.plan')}: <strong>{quota.planName}</strong>
            </span>
            <span>
              {t('ask.today')}:{' '}
              <strong>
                {quota.usedToday}
                {quota.unlimited ? ' / ∞' : ` / ${quota.dailyLimit}`}
              </strong>
            </span>
            {!quota.canPost && (
              <Link to="/subscriptions" className="btn btn-outline btn-sm">
                {t('common.upgrade')}
              </Link>
            )}
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="ask-form">
          <div className="form-group">
            <label htmlFor="ask-title">{t('ask.titleLabel')}</label>
            <p className="form-hint">{t('ask.titleHint')}</p>
            <input
              id="ask-title"
              type="text"
              name="title"
              placeholder={t('ask.titlePh')}
              value={formData.title}
              onChange={handleChange}
              maxLength={300}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="ask-description">{t('ask.descLabel')}</label>
            <p className="form-hint">{t('ask.descHint')}</p>
            <textarea
              id="ask-description"
              name="description"
              rows="10"
              placeholder={t('ask.descPh')}
              value={formData.description}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="ask-tags">{t('ask.tagsLabel')}</label>
            <p className="form-hint">{t('ask.tagsHint')}</p>
            <input
              id="ask-tags"
              type="text"
              name="tags"
              placeholder={t('ask.tagsPh')}
              value={formData.tags}
              onChange={handleChange}
            />
          </div>

          <div className="ask-form-actions">
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => navigate('/questions')}
              disabled={loading}
            >
              {t('ask.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? t('ask.posting') : t('ask.post')}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default AskQuestion;
