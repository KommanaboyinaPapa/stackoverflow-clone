import API from './api';

/** GET /api/points/me */
export const getMyPoints = () =>
  API.get('/points/me').then((res) => res.data);

/** GET /api/points/history */
export const getTransferHistory = () =>
  API.get('/points/history').then((res) => res.data);

/** GET /api/points/search?q= */
export const searchUsers = (q) =>
  API.get('/points/search', { params: { q } }).then((res) => res.data);

/** POST /api/points/transfer */
export const transferPoints = ({ search, amount }) =>
  API.post('/points/transfer', { search, amount }).then((res) => res.data);
