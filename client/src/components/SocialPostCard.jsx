import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  likePost,
  commentPost,
  sharePost,
  deletePost,
  mediaFullUrl,
} from '../services/socialService';
import getErrorMessage from '../utils/getErrorMessage';

const SocialPostCard = ({ post, onUpdate }) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const formatTimeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return t('social.justNow', 'Just now');
    if (mins < 60) return t('social.timeAgoMinutes', '{{count}}m ago', { count: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('social.timeAgoHours', '{{count}}h ago', { count: hrs });
    return t('social.timeAgoDays', '{{count}}d ago', { count: Math.floor(hrs / 24) });
  };
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likedByMe, setLikedByMe] = useState(post.likedByMe);
  const [shareCount, setShareCount] = useState(post.shareCount);
  const [sharedByMe, setSharedByMe] = useState(post.sharedByMe);
  const [comments, setComments] = useState(post.comments || []);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwner =
    user?.id?.toString() === post.user?._id?.toString() ||
    user?._id?.toString() === post.user?._id?.toString();

  const imageSources = (post.images || []).filter((src) => src?.trim());
  const videoSources = (post.videos || []).filter((src) => src?.trim());

  const getShareLink = () => {
    const url = window.location.origin + window.location.pathname + window.location.search;
    return `${url}#post-${post._id}`;
  };

  const copyShareLink = async () => {
    const shareLink = getShareLink();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareLink);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = shareLink;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const handleLike = async () => {
    setLoading('like');
    setError('');
    try {
      const data = await likePost(post._id);
      setLikeCount(data.likeCount);
      setLikedByMe(data.likedByMe);
    } catch (err) {
      setError(getErrorMessage(err, t('social.couldNotLike')));
    } finally {
      setLoading('');
    }
  };

  const handleShare = async () => {
    setLoading('share');
    setError('');
    setSuccess('');
    try {
      const data = await sharePost(post._id);
      setShareCount(data.shareCount);
      setSharedByMe(true);
      await copyShareLink();
      setSuccess(t('social.linkCopied'));
    } catch (err) {
      setError(getErrorMessage(err, t('social.couldNotShare')));
    } finally {
      setLoading('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('social.deleteConfirm'))) {
      return;
    }

    setLoading('delete');
    setError('');
    setSuccess('');
    try {
      await deletePost(post._id);
      onUpdate?.();
    } catch (err) {
      setError(getErrorMessage(err, t('social.couldNotDelete')));
    } finally {
      setLoading('');
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setLoading('comment');
    setError('');
    try {
      const data = await commentPost(post._id, commentText.trim());
      setComments((prev) => [...prev, data.comment]);
      setCommentText('');
      setShowComments(true);
      onUpdate?.();
    } catch (err) {
      setError(getErrorMessage(err, t('social.couldNotComment')));
    } finally {
      setLoading('');
    }
  };

  return (
    <article className="social-post-card">
      <header className="social-post-header">
        {post.user?.profileImage?.trim() && (
          <img
            src={mediaFullUrl(post.user.profileImage)}
            alt={`${post.user?.name || t('common.user')} avatar`}
            className="social-post-avatar"
          />
        )}
        <div>
          <strong className="social-post-author">{post.user?.name || t('common.user')}</strong>
          <span className="social-post-time">{formatTimeAgo(post.createdAt)}</span>
        </div>
      </header>

      {post.text && <p className="social-post-text">{post.text}</p>}

      {imageSources.length > 0 && (
        <div className="social-post-media social-images">
          {imageSources.map((src) => (
            <img key={src} src={mediaFullUrl(src)} alt={t('social.postImageAlt', 'Social post image')} />
          ))}
        </div>
      )}

      {videoSources.length > 0 && (
        <div className="social-post-media social-videos">
          {videoSources.map((src) => (
            <video key={src} src={mediaFullUrl(src)} controls />
          ))}
        </div>
      )}

      {error && <p className="social-post-error">{error}</p>}
      {success && <p className="social-post-success">{success}</p>}

      <div className="social-post-actions">
        <button
          type="button"
          className={`social-action-btn ${likedByMe ? 'active' : ''}`}
          onClick={handleLike}
          disabled={!!loading}
        >
          <span className="social-action-icon" aria-hidden="true">♥</span> {likeCount > 0 ? likeCount : ''}
        </button>
        <button
          type="button"
          className="social-action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          <span className="social-action-icon" aria-hidden="true">💬</span> {comments.length > 0 ? comments.length : ''}
        </button>
        <button
          type="button"
          className={`social-action-btn ${sharedByMe ? 'active' : ''}`}
          onClick={handleShare}
          disabled={!!loading}
        >
          <span className="social-action-icon" aria-hidden="true">↗</span> {t('social.share')} {shareCount > 0 ? `(${shareCount})` : ''}
        </button>
        {isOwner && (
          <button
            type="button"
            className="social-action-btn social-action-delete"
            onClick={handleDelete}
            disabled={!!loading}
          >
            <span className="social-action-icon" aria-hidden="true">🗑</span> {t('social.delete')}
          </button>
        )}
      </div>

      {showComments && (
        <div className="social-comments">
          <ul className="social-comment-list">
            {comments.map((c, index) => (
              <li key={c._id || `comment-${index}-${c.createdAt}`} className="social-comment-item">
                <strong>{c.user?.name || t('common.user')}</strong>
                <span>{c.text}</span>
                <small>{formatTimeAgo(c.createdAt)}</small>
              </li>
            ))}
          </ul>
          <form className="social-comment-form" onSubmit={handleComment}>
            <input
              type="text"
              placeholder={t('social.writeComment')}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={loading === 'comment'}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading === 'comment'}>
              {t('social.post')}
            </button>
          </form>
        </div>
      )}
    </article>
  );
};

export default SocialPostCard;