/**
 * Daily social post limits based on friend count.
 * 0 friends → cannot post
 * 1 friend → 1 post/day
 * 2 friends → 2 posts/day
 * 3–10 friends → same as friend count per day
 * >10 friends → unlimited
 */
const getDailyPostLimit = (friendCount) => {
  const count = friendCount || 0;
  if (count === 0) return 0;
  if (count > 10) return Infinity;
  return count;
};

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const LIMIT_MESSAGE = 'Posting limit reached. Add more friends to post.';

module.exports = { getDailyPostLimit, startOfToday, LIMIT_MESSAGE };
