const User = require('../models/User');

/** Add points to a user (never below 0). Returns new balance. */
const addPoints = async (userId, amount) => {
  if (!amount || amount <= 0) return null;
  const user = await User.findById(userId);
  if (!user) return null;
  user.points = (user.points || 0) + amount;
  await user.save();
  return user.points;
};

/** Remove points from a user (balance cannot go below 0). Returns new balance. */
const deductPoints = async (userId, amount) => {
  if (!amount || amount <= 0) return null;
  const user = await User.findById(userId);
  if (!user) return null;
  user.points = Math.max(0, (user.points || 0) - amount);
  await user.save();
  return user.points;
};

module.exports = { addPoints, deductPoints };
