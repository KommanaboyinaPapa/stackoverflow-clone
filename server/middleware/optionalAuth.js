const jwt = require('jsonwebtoken');
const User = require('../models/User');

/** Attach req.user when a valid token is present; continue without user otherwise */
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next();
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id).select('-password');
    if (user) req.user = user;
  } catch {
    // ignore invalid tokens for public reads
  }
  next();
};

module.exports = optionalAuth;
