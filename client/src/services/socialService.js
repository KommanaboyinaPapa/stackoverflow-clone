import API from './api';

const getServerBase = () => {
  const apiBase = String(API.defaults.baseURL || '');
  // Convert ".../api" -> "..." so we can construct /uploads URLs.
  return apiBase.replace(/\/api\/?$/, '');
};

export const mediaFullUrl = (path) => {
  if (!path) return '';
  
  // Already a full URL (old posts might have stored full URLs)
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // Handle different path formats for backward compatibility
  let cleanPath = path;
  
  // If path doesn't start with /, add it
  if (!cleanPath.startsWith('/')) {
    // Check if it's just a filename (old format)
    if (!cleanPath.includes('/')) {
      cleanPath = `/uploads/social/${cleanPath}`;
    } else if (cleanPath.startsWith('uploads/')) {
      // Old format: uploads/social/file.jpg -> /uploads/social/file.jpg
      cleanPath = `/${cleanPath}`;
    } else {
      // Any other relative path, add leading slash
      cleanPath = `/${cleanPath}`;
    }
  }
  
  return `${getServerBase()}${cleanPath}`;
};

export const getPostingLimit = () =>
  API.get('/social/posting-limit').then((r) => r.data);

export const getFeed = () => API.get('/social/feed').then((r) => r.data);

export const createPost = (formData) =>
  API.post('/social/posts', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then((r) => r.data);

export const likePost = (postId) =>
  API.put(`/social/posts/${postId}/like`).then((r) => r.data);

export const commentPost = (postId, text) =>
  API.post(`/social/posts/${postId}/comments`, { text }).then((r) => r.data);

export const sharePost = (postId) =>
  API.post(`/social/posts/${postId}/share`).then((r) => r.data);

export const deletePost = (postId) =>
  API.delete(`/posts/${postId}`).then((r) => r.data);

export const getFriendRequests = () =>
  API.get('/social/friends/requests').then((r) => r.data);

export const searchUsers = (q) =>
  API.get('/social/users/search', { params: { q } }).then((r) => r.data);

export const sendFriendRequest = (payload) =>
  API.post('/social/friends/request', payload).then((r) => r.data);

export const acceptFriendRequest = (id) =>
  API.put(`/social/friends/accept/${id}`).then((r) => r.data);

export const rejectFriendRequest = (id) =>
  API.put(`/social/friends/reject/${id}`).then((r) => r.data);
