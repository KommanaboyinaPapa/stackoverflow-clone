import API from './api';

/** GET /api/questions */
export const fetchQuestions = (params = {}) =>
  API.get('/questions', { params }).then((res) => res.data);

/** GET /api/questions/:id */
export const fetchQuestionById = (id) =>
  API.get(`/questions/${id}`).then((res) => res.data);

/** POST /api/questions/create (JWT attached by api interceptor) */
export const createQuestion = (payload) =>
  API.post('/questions/create', payload).then((res) => res.data);
