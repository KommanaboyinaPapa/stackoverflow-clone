const Question = require('../models/Question');
const Answer = require('../models/Answer');
const User = require('../models/User');
const { applyVote, getUserVote } = require('../utils/voteHelper');
const { addPoints, deductPoints } = require('../utils/pointsService');
const {
  POINTS_FOR_ANSWER,
  POINTS_BONUS_FIVE_UPVOTES,
  POINTS_DOWNVOTE_PENALTY,
  UPVOTE_BONUS_THRESHOLD,
} = require('../utils/pointsConfig');

const formatAnswer = (answer, userId) => ({
  _id: answer._id,
  body: answer.body,
  question: answer.question,
  voteScore: answer.voteScore ?? 0,
  createdAt: answer.createdAt,
  author: answer.author,
  userVote: getUserVote(answer, userId),
});

/** Award +5 bonus once when answer voteScore reaches 5 */
const tryAwardUpvoteBonus = async (answer) => {
  if (
    answer.voteScore >= UPVOTE_BONUS_THRESHOLD &&
    !answer.bonusPointsAwarded
  ) {
    answer.bonusPointsAwarded = true;
    await addPoints(answer.author, POINTS_BONUS_FIVE_UPVOTES);
    return true;
  }
  return false;
};

/** Handle point changes when votes change on an answer */
const handleAnswerVotePoints = async (answer, voteChange) => {
  const authorId = answer.author;

  if (voteChange === 'added_down' || voteChange === 'switched_to_down') {
    await deductPoints(authorId, POINTS_DOWNVOTE_PENALTY);
  }

  if (voteChange === 'removed_down' || voteChange === 'switched_to_up') {
    await addPoints(authorId, POINTS_DOWNVOTE_PENALTY);
  }

  if (
    voteChange === 'added_up' ||
    voteChange === 'switched_to_up' ||
    voteChange === 'removed_down'
  ) {
    await tryAwardUpvoteBonus(answer);
  }
};

// POST /api/answers/create
exports.createAnswer = async (req, res) => {
  try {
    const { questionId, body } = req.body;

    if (!questionId) {
      return res.status(400).json({ message: 'questionId is required' });
    }
    if (!body?.trim()) {
      return res.status(400).json({ message: 'Answer body is required' });
    }

    const question = await Question.findById(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found' });
    }

    const answer = await Answer.create({
      body: body.trim(),
      question: question._id,
      author: req.user._id,
      postPointsAwarded: true,
    });

    question.answerCount += 1;
    await question.save();

    await addPoints(req.user._id, POINTS_FOR_ANSWER);

    if (answer.voteScore >= UPVOTE_BONUS_THRESHOLD) {
      await tryAwardUpvoteBonus(answer);
      await answer.save();
    }

    await answer.populate('author', 'name profileImage');

    const authorUser = await User.findById(req.user._id).select('points');

    return res.status(201).json({
      success: true,
      message: 'Answer posted successfully',
      answer: formatAnswer(answer, req.user._id),
      pointsEarned: POINTS_FOR_ANSWER,
      authorPoints: authorUser?.points ?? 0,
    });
  } catch (error) {
    console.error('createAnswer error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/answers/upvote/:id
exports.upvoteAnswer = async (req, res) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    const { voteScore, voteChange } = applyVote(answer, req.user._id, 'up');
    await handleAnswerVotePoints(answer, voteChange);
    await answer.save();

    return res.json({
      success: true,
      voteScore,
      totalVotes: voteScore,
      userVote: getUserVote(answer, req.user._id),
    });
  } catch (error) {
    console.error('upvoteAnswer error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/answers/downvote/:id
exports.downvoteAnswer = async (req, res) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    const { voteScore, voteChange } = applyVote(answer, req.user._id, 'down');
    await handleAnswerVotePoints(answer, voteChange);
    await answer.save();

    return res.json({
      success: true,
      voteScore,
      totalVotes: voteScore,
      userVote: getUserVote(answer, req.user._id),
    });
  } catch (error) {
    console.error('downvoteAnswer error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/answers/:id — author only; deducts reward points
exports.deleteAnswer = async (req, res) => {
  try {
    const answer = await Answer.findById(req.params.id);
    if (!answer) {
      return res.status(404).json({ message: 'Answer not found' });
    }

    if (answer.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this answer' });
    }

    if (answer.postPointsAwarded) {
      await deductPoints(answer.author, POINTS_FOR_ANSWER);
    }
    if (answer.bonusPointsAwarded) {
      await deductPoints(answer.author, POINTS_BONUS_FIVE_UPVOTES);
    }

    await Question.findByIdAndUpdate(answer.question, { $inc: { answerCount: -1 } });
    await answer.deleteOne();

    return res.json({
      success: true,
      message: 'Answer deleted. Related points have been deducted.',
    });
  } catch (error) {
    console.error('deleteAnswer error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
