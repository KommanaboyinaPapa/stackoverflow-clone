const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { uploadSocialMedia } = require('../middleware/uploadSocial');
const {
  getPostingLimit,
  createPost,
  getFeed,
  likePost,
  commentPost,
  sharePost,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriendRequests,
  searchUsersForFriends,
} = require('../controllers/socialController');

router.use(auth);

router.get('/posting-limit', getPostingLimit);
router.get('/feed', getFeed);
router.post('/posts', (req, res, next) => {
  uploadSocialMedia(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Upload failed' });
    }
    next();
  });
}, createPost);
router.put('/posts/:id/like', likePost);
router.post('/posts/:id/comments', commentPost);
router.post('/posts/:id/share', sharePost);

router.get('/friends/requests', getFriendRequests);
router.get('/users/search', searchUsersForFriends);
router.post('/friends/request', sendFriendRequest);
router.put('/friends/accept/:id', acceptFriendRequest);
router.put('/friends/reject/:id', rejectFriendRequest);

module.exports = router;
