const Question = require('../models/Question');
const { getPlanById } = require('../config/subscriptionPlans');

const SUBSCRIPTION_DURATION_DAYS = 30;

/** Start/end of current calendar day in Asia/Kolkata as Date objects */
const getISTDayRange = (date = new Date()) => {
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(`${dateStr}T23:59:59.999+05:30`);
  return { start, end };
};

/**
 * Effective plan: paid plans expire after subscriptionExpiresAt.
 */
const getEffectivePlanId = (user) => {
  const planId = user.subscriptionPlan || 'free';
  if (planId === 'free') return 'free';

  if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) {
    return 'free';
  }

  return planId;
};

const getDailyQuestionLimit = (planId) => {
  const plan = getPlanById(planId);
  if (!plan) return 1;
  return plan.dailyQuestionLimit;
};

const countQuestionsToday = async (userId) => {
  const { start, end } = getISTDayRange();
  return Question.countDocuments({
    user: userId,
    createdAt: { $gte: start, $lte: end },
  });
};

const getQuestionQuota = async (user) => {
  const planId = getEffectivePlanId(user);
  const plan = getPlanById(planId);
  const usedToday = await countQuestionsToday(user._id);
  const limit = getDailyQuestionLimit(planId);
  const unlimited = limit === null;

  return {
    planId,
    planName: plan?.name || 'Free',
    usedToday,
    dailyLimit: limit,
    unlimited,
    remaining: unlimited ? null : Math.max(0, limit - usedToday),
    canPost: unlimited || usedToday < limit,
    resetsAtIST: 'midnight IST',
  };
};

const assertCanPostQuestion = async (user) => {
  const quota = await getQuestionQuota(user);
  if (quota.canPost) return quota;

  const limitLabel = quota.unlimited ? 'unlimited' : quota.dailyLimit;
  const err = new Error(
    `Daily question limit reached (${quota.usedToday}/${limitLabel}) on your ${quota.planName} plan. Upgrade your subscription or try again tomorrow (IST).`
  );
  err.statusCode = 403;
  err.quota = quota;
  throw err;
};

const activateSubscription = (user, planId) => {
  const now = new Date();
  const expires = new Date(now);
  expires.setDate(expires.getDate() + SUBSCRIPTION_DURATION_DAYS);

  user.subscriptionPlan = planId;
  user.subscriptionActiveAt = now;
  user.subscriptionExpiresAt = expires;
  return user;
};

const buildSubscriptionSummary = (user) => {
  const effectivePlanId = getEffectivePlanId(user);
  const plan = getPlanById(effectivePlanId);
  return {
    planId: effectivePlanId,
    planName: plan?.name || 'Free',
    storedPlanId: user.subscriptionPlan || 'free',
    subscriptionActiveAt: user.subscriptionActiveAt || null,
    subscriptionExpiresAt: user.subscriptionExpiresAt || null,
    isExpired:
      user.subscriptionPlan &&
      user.subscriptionPlan !== 'free' &&
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) < new Date(),
  };
};

module.exports = {
  SUBSCRIPTION_DURATION_DAYS,
  getISTDayRange,
  getEffectivePlanId,
  getDailyQuestionLimit,
  countQuestionsToday,
  getQuestionQuota,
  assertCanPostQuestion,
  activateSubscription,
  buildSubscriptionSummary,
};
