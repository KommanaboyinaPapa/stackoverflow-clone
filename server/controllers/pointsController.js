const User = require('../models/User');
const PointTransfer = require('../models/PointTransfer');
const { MIN_POINTS_TO_TRANSFER } = require('../utils/pointsConfig');

// GET /api/points/me
exports.getMyPoints = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('points name');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.json({
      success: true,
      points: user.points ?? 0,
      name: user.name,
    });
  } catch (error) {
    console.error('getMyPoints error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/points/transfer  body: { search, amount }
exports.transferPoints = async (req, res) => {
  try {
    const { search, amount } = req.body;
    const transferAmount = Number(amount);

    if (!search?.trim()) {
      return res.status(400).json({ message: 'Please enter a name or email to search.' });
    }
    if (!transferAmount || transferAmount < 1 || !Number.isInteger(transferAmount)) {
      return res.status(400).json({ message: 'Please enter a valid whole number of points.' });
    }

    const sender = await User.findById(req.user._id);
    if (!sender) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (sender.points <= MIN_POINTS_TO_TRANSFER) {
      return res.status(400).json({
        message: 'You need more than 10 points to transfer.',
      });
    }

    if (sender.points < transferAmount) {
      return res.status(400).json({
        message: `You only have ${sender.points} points. Cannot transfer ${transferAmount}.`,
      });
    }

    const query = search.trim();
    const isEmail = query.includes('@');

    const recipient = await User.findOne({
      _id: { $ne: sender._id },
      ...(isEmail
        ? { email: query.toLowerCase() }
        : { name: { $regex: query, $options: 'i' } }),
    });

    if (!recipient) {
      return res.status(404).json({
        message: 'No user found with that name or email.',
      });
    }

    sender.points -= transferAmount;
    recipient.points = (recipient.points || 0) + transferAmount;
    await sender.save();
    await recipient.save();

    const transfer = await PointTransfer.create({
      fromUser: sender._id,
      toUser: recipient._id,
      amount: transferAmount,
      note: `Transfer from ${sender.name} to ${recipient.name}`,
    });

    await transfer.populate([
      { path: 'fromUser', select: 'name email' },
      { path: 'toUser', select: 'name email' },
    ]);

    return res.json({
      success: true,
      message: `Successfully transferred ${transferAmount} points to ${recipient.name}.`,
      points: sender.points,
      transfer: {
        _id: transfer._id,
        amount: transfer.amount,
        createdAt: transfer.createdAt,
        fromUser: { name: transfer.fromUser.name, email: transfer.fromUser.email },
        toUser: { name: transfer.toUser.name, email: transfer.toUser.email },
      },
    });
  } catch (error) {
    console.error('transferPoints error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/points/history
exports.getTransferHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const transfers = await PointTransfer.find({
      $or: [{ fromUser: userId }, { toUser: userId }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email');

    const history = transfers.map((t) => {
      const isSender = t.fromUser._id.toString() === userId.toString();
      return {
        _id: t._id,
        amount: t.amount,
        createdAt: t.createdAt,
        type: isSender ? 'sent' : 'received',
        otherUser: isSender
          ? { name: t.toUser.name, email: t.toUser.email }
          : { name: t.fromUser.name, email: t.fromUser.email },
      };
    });

    return res.json({ success: true, history });
  } catch (error) {
    console.error('getTransferHistory error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/points/search?q=  — find users by name/email (for transfer)
exports.searchUsers = async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Enter at least 2 characters to search.' });
    }

    const isEmail = q.includes('@');
    const users = await User.find({
      _id: { $ne: req.user._id },
      ...(isEmail
        ? { email: q.toLowerCase() }
        : { name: { $regex: q, $options: 'i' } }),
    })
      .select('name email points profileImage')
      .limit(8);

    return res.json({
      success: true,
      users: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        points: u.points ?? 0,
      })),
    });
  } catch (error) {
    console.error('searchUsers error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
