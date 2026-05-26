const Question = require('../models/Question');
const Answer = require('../models/Answer');
const { applyVote, getUserVote } = require('../utils/voteHelper');
const { assertCanPostQuestion } = require('../utils/subscriptionHelper');

const parseTags = (tags) =>
  Array.isArray(tags)
    ? tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 5)
    : String(tags || '')
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 5);

const formatQuestion = (q, userId) => ({
  _id: q._id,
  title: q.title,
  description: q.description,
  tags: q.tags,
  voteScore: q.voteScore ?? 0,
  answerCount: q.answerCount ?? 0,
  createdAt: q.createdAt,
  updatedAt: q.updatedAt,
  user: q.user,
  userVote: getUserVote(q, userId),
});

// GET /api/questions
exports.getQuestions = async (req, res) => {
  try {
    const { sort = 'newest', search = '' } = req.query;
    const filter = search
      ? {
          $or: [
            { title: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
            { tags: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    let sortOption = { createdAt: -1 };
    if (sort === 'votes') sortOption = { voteScore: -1, createdAt: -1 };

    const questions = await Question.find(filter)
      .populate('user', 'name profileImage')
      .sort(sortOption);

    const userId = req.user?._id;
    res.json({
      questions: questions.map((q) => formatQuestion(q, userId)),
    });
  } catch (error) {
    console.error('getQuestions error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/questions/:id
exports.getQuestionById = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id).populate('user', 'name profileImage');
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const answers = await Answer.find({ question: question._id })
      .populate('author', 'name profileImage')
      .sort({ voteScore: -1, createdAt: 1 });

    const userId = req.user?._id;
    res.json({
      success: true,
      question: formatQuestion(question, userId),
      answers: answers.map((a) => ({
        _id: a._id,
        body: a.body,
        voteScore: a.voteScore ?? 0,
        totalVotes: a.voteScore ?? 0,
        createdAt: a.createdAt,
        author: a.author,
        userVote: getUserVote(a, userId),
      })),
    });
  } catch (error) {
    console.error('getQuestionById error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/questions/create
exports.createQuestion = async (req, res) => {
  try {
    const { title, description, tags } = req.body;

    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    try {
      await assertCanPostQuestion(req.user);
    } catch (limitErr) {
      return res.status(limitErr.statusCode || 403).json({
        message: limitErr.message,
        code: 'QUESTION_LIMIT_REACHED',
        quota: limitErr.quota,
      });
    }

    const question = await Question.create({
      title: title.trim(),
      description: description.trim(),
      tags: parseTags(tags),
      user: req.user._id,
    });

    await question.populate('user', 'name profileImage');
    res.status(201).json({
      message: 'Question created successfully',
      question: formatQuestion(question, req.user._id),
    });
  } catch (error) {
    console.error('createQuestion error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/questions/:id
exports.updateQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });
    if (question.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this question' });
    }

    const { title, description, tags } = req.body;
    if (title) question.title = title.trim();
    if (description) question.description = description.trim();
    if (tags !== undefined) question.tags = parseTags(tags);

    await question.save();
    await question.populate('user', 'name profileImage');
    res.json({ message: 'Question updated', question: formatQuestion(question, req.user._id) });
  } catch (error) {
    console.error('updateQuestion error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/questions/:id
exports.deleteQuestion = async (req, res) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });
    if (question.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this question' });
    }

    await Answer.deleteMany({ question: question._id });
    await question.deleteOne();
    res.json({ message: 'Question deleted' });
  } catch (error) {
    console.error('deleteQuestion error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/questions/:id/vote
exports.voteQuestion = async (req, res) => {
  try {
    const { voteType } = req.body;
    if (!['up', 'down'].includes(voteType)) {
      return res.status(400).json({ message: 'voteType must be "up" or "down"' });
    }

    const question = await Question.findById(req.params.id);
    if (!question) return res.status(404).json({ message: 'Question not found' });

    const { voteScore } = applyVote(question, req.user._id, voteType);
    await question.save();

    res.json({
      voteScore,
      totalVotes: voteScore,
      userVote: getUserVote(question, req.user._id),
    });
  } catch (error) {
    console.error('voteQuestion error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};
