const mongoose = require('mongoose');

const pointTransferSchema = new mongoose.Schema(
  {
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    note: {
      type: String,
      default: 'Point transfer',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('PointTransfer', pointTransferSchema);
