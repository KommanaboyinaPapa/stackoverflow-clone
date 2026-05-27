import API from './api';

/**
 * POST /api/answers/create
 * Requires JWT (added automatically by api.js)
 */
export const createAnswer = ({ questionId, body }) =>
  API.post('/answers/create', { questionId, body }).then((res) => res.data);

/**
 * PUT /api/answers/upvote/:id
 */
export const upvoteAnswer = (answerId) =>
  API.put(`/answers/upvote/${answerId}`).then((res) => res.data);

/**
 * PUT /api/answers/downvote/:id
 */
export const downvoteAnswer = (answerId) =>
  API.put(`/answers/downvote/${answerId}`).then((res) => res.data);

/**
 * DELETE /api/answers/:id
 * Requires JWT (added automatically by api.js)
 */
export const deleteAnswer = (answerId) =>
  API.delete(`/answers/${answerId}`).then((res) => res.data);
