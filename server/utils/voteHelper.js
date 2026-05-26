/**
 * Toggle or switch a user's vote on a document with a votes[] array.
 * Returns { voteScore, voteChange } where voteChange describes what happened.
 */
const applyVote = (doc, userId, voteType) => {
  const uid = userId.toString();
  const existing = doc.votes.find((v) => v.user.toString() === uid);
  let voteChange = 'none';

  if (existing) {
    if (existing.voteType === voteType) {
      doc.votes = doc.votes.filter((v) => v.user.toString() !== uid);
      voteChange = voteType === 'up' ? 'removed_up' : 'removed_down';
    } else {
      existing.voteType = voteType;
      voteChange = voteType === 'up' ? 'switched_to_up' : 'switched_to_down';
    }
  } else {
    doc.votes.push({ user: userId, voteType });
    voteChange = voteType === 'up' ? 'added_up' : 'added_down';
  }

  doc.voteScore = doc.votes.reduce(
    (sum, v) => sum + (v.voteType === 'up' ? 1 : -1),
    0
  );

  return { voteScore: doc.voteScore, voteChange };
};

const getUserVote = (doc, userId) => {
  if (!userId || !doc.votes) return null;
  const uid = userId.toString();
  const found = doc.votes.find((v) => v.user.toString() === uid);
  return found ? found.voteType : null;
};

module.exports = { applyVote, getUserVote };
