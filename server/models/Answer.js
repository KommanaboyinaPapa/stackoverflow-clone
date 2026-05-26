const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    voteType: { type: String, enum: ['up', 'down'], required: true },
  },
  { _id: false }
);

// Answer schema — stored in MongoDB "answers" collection
const answerSchema = new mongoose.Schema(
  {
    body: {
      type: String,
      required: [true, 'Answer text is required'],
    },
    question: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    votes: [voteSchema],
    voteScore: { type: Number, default: 0 },
    postPointsAwarded: { type: Boolean, default: false },
    bonusPointsAwarded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Answer', answerSchema);
