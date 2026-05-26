const path = require('path');
const User = require('../models/User');
const SocialPost = require('../models/SocialPost');
const FriendRequest = require('../models/FriendRequest');
const {
  getDailyPostLimit,
  startOfToday,
  LIMIT_MESSAGE,
} = require('../utils/postingLimits');

const mediaUrl = (filename) => `/uploads/social/${filename}`;

const formatPost = (post, userId) => {
  const uid = userId?.toString();
  return {
    _id: post._id,
    text: post.text,
    images: post.images || [],
    videos: post.videos || [],
    likeCount: post.likes?.length || 0,
    commentCount: post.comments?.length || 0,
    shareCount: post.shares?.length || 0,
    likedByMe: uid ? post.likes?.some((id) => id.toString() === uid) : false,
    sharedByMe: uid ? post.shares?.some((id) => id.toString() === uid) : false,
    comments: (post.comments || []).map((c) => ({
      _id: c._id,
      text: c.text,
      createdAt: c.createdAt,
      user: c.user,
    })),
    createdAt: post.createdAt,
    user: post.user,
  };
};

const getFriendCount = async (userId) => {
  const user = await User.findById(userId).select('friends');
  return user?.friends?.length || 0;
};

const countPostsToday = async (userId) =>
  SocialPost.countDocuments({
    user: userId,
    createdAt: { $gte: startOfToday() },
  });

const canUserPost = async (userId) => {
  const friendCount = await getFriendCount(userId);
  const limit = getDailyPostLimit(friendCount);
  if (limit === 0) {
    return { allowed: false, message: LIMIT_MESSAGE, limit: 0, friendCount };
  }
  if (limit === Infinity) {
    return { allowed: true, limit: 'unlimited', friendCount };
  }
  const todayCount = await countPostsToday(userId);
  if (todayCount >= limit) {
    return { allowed: false, message: LIMIT_MESSAGE, limit, friendCount, todayCount };
  }
  return { allowed: true, limit, friendCount, todayCount };
};

// GET /api/social/posting-limit
exports.getPostingLimit = async (req, res) => {
  try {
    const check = await canUserPost(req.user._id);
    return res.json({
      success: true,
      friendCount: check.friendCount,
      dailyLimit: check.limit === Infinity ? 'unlimited' : check.limit,
      postsToday: check.todayCount ?? await countPostsToday(req.user._id),
      canPost: check.allowed,
      message: check.allowed ? null : check.message,
    });
  } catch (error) {
    console.error('getPostingLimit error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/social/posts
exports.createPost = async (req, res) => {
  try {
    const check = await canUserPost(req.user._id);
    if (!check.allowed) {
      return res.status(403).json({ message: check.message || LIMIT_MESSAGE });
    }

    const text = req.body.text?.trim() || '';
    const images = (req.files?.images || []).map((f) => mediaUrl(f.filename));
    const videos = (req.files?.videos || []).map((f) => mediaUrl(f.filename));

    if (!text && images.length === 0 && videos.length === 0) {
      return res.status(400).json({ message: 'Add text, an image, or a video to post.' });
    }

    const post = await SocialPost.create({
      user: req.user._id,
      text,
      images,
      videos,
    });

    await post.populate('user', 'name profileImage');
    return res.status(201).json({
      success: true,
      message: 'Post created',
      post: formatPost(post, req.user._id),
    });
  } catch (error) {
    console.error('createPost error:', error.message);
    return res.status(500).json({ message: error.message || 'Server error' });
  }
};

// GET /api/social/feed
exports.getFeed = async (req, res) => {
  try {
    const posts = await SocialPost.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('user', 'name profileImage')
      .populate('comments.user', 'name profileImage');

    return res.json({
      success: true,
      posts: posts.map((p) => formatPost(p, req.user._id)),
    });
  } catch (error) {
    console.error('getFeed error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/social/posts/:id/like
exports.likePost = async (req, res) => {
  try {
    const post = await SocialPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const uid = req.user._id.toString();
    const idx = post.likes.findIndex((id) => id.toString() === uid);

    if (idx >= 0) {
      post.likes.splice(idx, 1);
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();
    return res.json({
      success: true,
      likeCount: post.likes.length,
      likedByMe: idx < 0,
    });
  } catch (error) {
    console.error('likePost error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/social/posts/:id/comments
exports.commentPost = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ message: 'Comment text is required.' });
    }

    const post = await SocialPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    post.comments.push({ user: req.user._id, text: text.trim() });
    await post.save();

    const fresh = await SocialPost.findById(post._id).populate(
      'comments.user',
      'name profileImage'
    );
    const populated = fresh.comments[fresh.comments.length - 1];

    return res.status(201).json({
      success: true,
      comment: {
        _id: populated._id,
        text: populated.text,
        createdAt: populated.createdAt,
        user: populated.user,
      },
      commentCount: fresh.comments.length,
    });
  } catch (error) {
    console.error('commentPost error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/social/posts/:id/share
exports.sharePost = async (req, res) => {
  try {
    const post = await SocialPost.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const uid = req.user._id.toString();
    const already = post.shares.some((id) => id.toString() === uid);

    if (!already) {
      post.shares.push(req.user._id);
      await post.save();
    }

    return res.json({
      success: true,
      message: 'Post shared',
      shareCount: post.shares.length,
      sharedByMe: true,
    });
  } catch (error) {
    console.error('sharePost error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/posts/:id
exports.deletePost = async (req, res) => {
  try {
    const post = await SocialPost.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (post.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await post.deleteOne();
    return res.json({ success: true, message: 'Post deleted' });
  } catch (error) {
    console.error('deletePost error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/social/friends/request  body: { userId } or { search }
exports.sendFriendRequest = async (req, res) => {
  try {
    let toUserId = req.body.userId;

    if (!toUserId && req.body.search?.trim()) {
      const q = req.body.search.trim();
      const isEmail = q.includes('@');
      const found = await User.findOne({
        _id: { $ne: req.user._id },
        ...(isEmail ? { email: q.toLowerCase() } : { name: { $regex: q, $options: 'i' } }),
      });
      if (!found) {
        return res.status(404).json({ message: 'User not found.' });
      }
      toUserId = found._id;
    }

    if (!toUserId) {
      return res.status(400).json({ message: 'Provide userId or search (name/email).' });
    }

    if (toUserId.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot add yourself as a friend.' });
    }

    const me = await User.findById(req.user._id);
    if (me.friends.some((id) => id.toString() === toUserId.toString())) {
      return res.status(400).json({ message: 'Already friends with this user.' });
    }

    const existing = await FriendRequest.findOne({
      $or: [
        { fromUser: req.user._id, toUser: toUserId },
        { fromUser: toUserId, toUser: req.user._id },
      ],
      status: 'pending',
    });

    if (existing) {
      return res.status(400).json({ message: 'Friend request already pending.' });
    }

    const request = await FriendRequest.create({
      fromUser: req.user._id,
      toUser: toUserId,
      status: 'pending',
    });

    await request.populate('fromUser', 'name profileImage email');
    await request.populate('toUser', 'name profileImage email');

    return res.status(201).json({
      success: true,
      message: 'Friend request sent',
      request,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Request already exists.' });
    }
    console.error('sendFriendRequest error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/social/friends/accept/:id
exports.acceptFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ message: 'Request not found.' });
    }

    if (request.toUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    request.status = 'accepted';
    await request.save();

    await User.findByIdAndUpdate(request.fromUser, {
      $addToSet: { friends: request.toUser },
    });
    await User.findByIdAndUpdate(request.toUser, {
      $addToSet: { friends: request.fromUser },
    });

    const friendCount = await getFriendCount(req.user._id);

    return res.json({
      success: true,
      message: 'Friend request accepted',
      friendCount,
    });
  } catch (error) {
    console.error('acceptFriendRequest error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/social/friends/reject/:id
exports.rejectFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request || request.status !== 'pending') {
      return res.status(404).json({ message: 'Request not found.' });
    }

    if (request.toUser.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    request.status = 'rejected';
    await request.save();

    return res.json({ success: true, message: 'Friend request rejected' });
  } catch (error) {
    console.error('rejectFriendRequest error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/social/friends/requests
exports.getFriendRequests = async (req, res) => {
  try {
    const incoming = await FriendRequest.find({
      toUser: req.user._id,
      status: 'pending',
    })
      .populate('fromUser', 'name profileImage email')
      .sort({ createdAt: -1 });

    const outgoing = await FriendRequest.find({
      fromUser: req.user._id,
      status: 'pending',
    })
      .populate('toUser', 'name profileImage email')
      .sort({ createdAt: -1 });

    const friendCount = await getFriendCount(req.user._id);

    return res.json({
      success: true,
      incoming,
      outgoing,
      friendCount,
    });
  } catch (error) {
    console.error('getFriendRequests error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/social/users/search?q=
exports.searchUsersForFriends = async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Enter at least 2 characters.' });
    }

    const isEmail = q.includes('@');
    const users = await User.find({
      _id: { $ne: req.user._id },
      ...(isEmail ? { email: q.toLowerCase() } : { name: { $regex: q, $options: 'i' } }),
    })
      .select('name email profileImage')
      .limit(8);

    // Filter out already-friends and users with pending requests
    const me = await User.findById(req.user._id).select('friends');
    const friendIds = (me?.friends || []).map((id) => id.toString());
    const pendingRequests = await FriendRequest.find({
      $or: [
        { fromUser: req.user._id },
        { toUser: req.user._id },
      ],
      status: 'pending',
    }).select('fromUser toUser');
    const pendingUserIds = pendingRequests
      .map((r) => [r.fromUser.toString(), r.toUser.toString()])
      .flat();

    const filtered = users.filter(
      (u) => !friendIds.includes(u._id.toString()) && !pendingUserIds.includes(u._id.toString())
    );

    return res.json({ success: true, users: filtered });
  } catch (error) {
    console.error('searchUsersForFriends error:', error.message);
    return res.status(500).json({ message: 'Server error' });
  }
};
