import API from './api';

const SERVER_BASE =
  (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

export const mediaFullUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `${SERVER_BASE}${path}`;
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
