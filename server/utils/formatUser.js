const defaultAvatar = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=f48225&color=fff&size=128`;

/** Normalize user document for API responses (supports legacy profilePic in DB) */
const formatUser = (user) => {
  const rawImage = user.profileImage || user.profilePic || '';
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    profileImage: rawImage || defaultAvatar(user.name),
    points: user.points ?? 0,
    friends: user.friends || [],
    preferredLanguage: user.preferredLanguage || 'en',
    phone: user.phone || '',
    createdAt: user.createdAt,
  };
};

module.exports = { formatUser, defaultAvatar };
