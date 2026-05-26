const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getMyPoints,
  transferPoints,
  getTransferHistory,
  searchUsers,
} = require('../controllers/pointsController');

router.get('/me', auth, getMyPoints);
router.get('/history', auth, getTransferHistory);
router.get('/search', auth, searchUsers);
router.post('/transfer', auth, transferPoints);

module.exports = router;
