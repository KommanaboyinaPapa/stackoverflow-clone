import React, { useRef, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { createPost } from '../services/socialService';
import getErrorMessage from '../utils/getErrorMessage';

const formatFileList = (files) => {
  if (!files.length) return [];
  return files.map((file, index) => ({
    id: `${file.name}-${file.size}-${index}`,
    name: file.name,
  }));
};

const CreatePostForm = ({ canPost, limitInfo, onPosted }) => {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const clearFileInputs = () => {
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  if (!canPost) {
    return (
      <div className="create-post-block create-post-disabled">
        <p className="alert alert-error">
          {limitInfo?.message || t('social.postingLimitReached')}
        </p>
        <p className="form-hint">
          {t('social.friends')}: {limitInfo?.friendCount ?? 0} · {t('social.dailyLimit')}:{' '}
          {limitInfo?.dailyLimit === 'unlimited'
            ? t('social.unlimited')
            : limitInfo?.dailyLimit ?? 0}
        </p>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!text.trim() && images.length === 0 && videos.length === 0) {
      setError(t('social.addContent'));
      return;
    }

    const formData = new FormData();
    if (text.trim()) formData.append('text', text.trim());
    images.forEach((file) => formData.append('images', file));
    videos.forEach((file) => formData.append('videos', file));

    setLoading(true);
    try {
      await createPost(formData);
      setText('');
      setImages([]);
      setVideos([]);
      clearFileInputs();
      onPosted?.();
    } catch (err) {
      const msg = err.response?.data?.message || getErrorMessage(err, t('social.failedToCreate'));
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const imageFiles = formatFileList(images);
  const videoFiles = formatFileList(videos);

  return (
    <div className="create-post-block">
      <div className="create-post-block-header">
        <h3>{t('social.create')}</h3>
        <p className="form-hint limit-hint">
          {t('social.friends')}: <strong>{limitInfo?.friendCount ?? 0}</strong> · {t('social.postsToday')}:{' '}
          <strong>{limitInfo?.postsToday ?? 0}</strong> /{' '}
          {limitInfo?.dailyLimit === 'unlimited' ? '∞' : limitInfo?.dailyLimit}
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="create-post-form">
        <textarea
          rows="3"
          placeholder={t('social.whatsOnMind')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
        />

        <div className="create-post-upload-section">
          <p className="upload-section-label">{t('social.attachments')}</p>
          <div className="create-post-uploads">
            <div className="upload-field">
              <input
                ref={imageInputRef}
                id="post-images-input"
                className="upload-input-hidden"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setImages(Array.from(e.target.files || []))}
                disabled={loading}
              />
              <label htmlFor="post-images-input" className="upload-btn upload-btn-images">
                <span className="upload-btn-icon" aria-hidden="true">
                  📷
                </span>
                <span className="upload-btn-label">{t('social.addImages')}</span>
              </label>
              {imageFiles.length > 0 && (
                <ul className="upload-file-list" aria-live="polite">
                  {imageFiles.map((file) => (
                    <li key={file.id} className="upload-file-item">
                      <span className="upload-file-name" title={file.name}>
                        {file.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="upload-field">
              <input
                ref={videoInputRef}
                id="post-videos-input"
                className="upload-input-hidden"
                type="file"
                accept="video/*"
                multiple
                onChange={(e) => setVideos(Array.from(e.target.files || []))}
                disabled={loading}
              />
              <label htmlFor="post-videos-input" className="upload-btn upload-btn-videos">
                <span className="upload-btn-icon" aria-hidden="true">
                  🎬
                </span>
                <span className="upload-btn-label">{t('social.addVideos')}</span>
              </label>
              {videoFiles.length > 0 && (
                <ul className="upload-file-list" aria-live="polite">
                  {videoFiles.map((file) => (
                    <li key={file.id} className="upload-file-item">
                      <span className="upload-file-name" title={file.name}>
                        {file.name}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? t('social.posting') : t('social.post')}
        </button>
      </form>
    </div>
  );
};

export default CreatePostForm;