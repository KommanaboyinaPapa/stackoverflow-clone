const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const {
  getQuestions,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  voteQuestion,
} = require('../controllers/questionController');

// GET /api/questions — list all questions (public)
router.get('/', optionalAuth, getQuestions);

// POST /api/questions/create — create question (protected)
router.post('/create', auth, createQuestion);

// GET /api/questions/:id — single question + answers (public)
router.get('/:id', optionalAuth, getQuestionById);

// Extra routes (optional, for editing / question votes)
router.put('/:id', auth, updateQuestion);
router.delete('/:id', auth, deleteQuestion);
router.post('/:id/vote', auth, voteQuestion);

module.exports = router;
