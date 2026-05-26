import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  likePost,
  commentPost,
  sharePost,
  deletePost,
  mediaFullUrl,
} from '../services/socialService';
import getErrorMessage from '../utils/getErrorMessage';

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins || 1}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const SocialPostCard = ({ post, onUpdate }) => {
  const { user } = useAuth();
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
      setError(getErrorMessage(err, 'Could not like post.'));
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
      setSuccess('Post link copied!');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not share post.'));
    } finally {
      setLoading('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this post? This cannot be undone.')) {
      return;
    }

    setLoading('delete');
    setError('');
    setSuccess('');
    try {
      await deletePost(post._id);
      onUpdate?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete post.'));
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
      setError(getErrorMessage(err, 'Could not post comment.'));
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
            alt={`${post.user?.name || 'User'} avatar`}
            className="social-post-avatar"
          />
        )}
        <div>
          <strong className="social-post-author">{post.user?.name || 'User'}</strong>
          <span className="social-post-time">{timeAgo(post.createdAt)}</span>
        </div>
      </header>

      {post.text && <p className="social-post-text">{post.text}</p>}

      {imageSources.length > 0 && (
        <div className="social-post-media social-images">
          {imageSources.map((src) => (
            <img key={src} src={mediaFullUrl(src)} alt="Post" />
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
          ♥ {likeCount}
        </button>
        <button
          type="button"
          className="social-action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          💬 {comments.length}
        </button>
        <button
          type="button"
          className={`social-action-btn ${sharedByMe ? 'active' : ''}`}
          onClick={handleShare}
          disabled={!!loading}
        >
          ↗ Share {shareCount > 0 ? `(${shareCount})` : ''}
        </button>
        {isOwner && (
          <button
            type="button"
            className="social-action-btn social-action-delete"
            onClick={handleDelete}
            disabled={!!loading}
          >
            🗑 Delete
          </button>
        )}
      </div>

      {showComments && (
        <div className="social-comments">
          <ul className="social-comment-list">
            {comments.map((c, index) => (
              <li key={c._id || `comment-${index}-${c.createdAt}`} className="social-comment-item">
                <strong>{c.user?.name || 'User'}</strong>
                <span>{c.text}</span>
                <small>{timeAgo(c.createdAt)}</small>
              </li>
            ))}
          </ul>
          <form className="social-comment-form" onSubmit={handleComment}>
            <input
              type="text"
              placeholder="Write a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              disabled={loading === 'comment'}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading === 'comment'}>
              Post
            </button>
          </form>
        </div>
      )}
    </article>
  );
};

export default SocialPostCard;
