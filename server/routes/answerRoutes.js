const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createAnswer,
  upvoteAnswer,
  downvoteAnswer,
  deleteAnswer,
} = require('../controllers/answerController');

// POST /api/answers/create (protected – JWT required)
router.post('/create', auth, createAnswer);

// PUT /api/answers/upvote/:id (protected)
router.put('/upvote/:id', auth, upvoteAnswer);

// PUT /api/answers/downvote/:id (protected)
router.put('/downvote/:id', auth, downvoteAnswer);

// DELETE /api/answers/:id (protected — author only)
router.delete('/:id', auth, deleteAnswer);

module.exports = router;
