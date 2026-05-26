/**
 * Subscription plan definitions (single source of truth).
 * dailyQuestionLimit: null = unlimited
 */
const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    priceInr: 0,
    dailyQuestionLimit: 1,
    description: 'Perfect to get started',
    features: ['1 question per day', 'Community answers', 'Basic profile'],
  },
  bronze: {
    id: 'bronze',
    name: 'Bronze',
    priceInr: 100,
    dailyQuestionLimit: 5,
    description: 'For regular learners',
    features: ['5 questions per day', 'Priority listing', 'Bronze badge on profile'],
  },
  silver: {
    id: 'silver',
    name: 'Silver',
    priceInr: 300,
    dailyQuestionLimit: 10,
    description: 'For active contributors',
    features: ['10 questions per day', 'Silver badge on profile', 'Enhanced visibility'],
  },
  gold: {
    id: 'gold',
    name: 'Gold',
    priceInr: 1000,
    dailyQuestionLimit: null,
    description: 'For power users',
    features: ['Unlimited questions', 'Gold badge on profile', 'Maximum visibility'],
  },
};

const PAID_PLAN_IDS = ['bronze', 'silver', 'gold'];

const getPlanById = (planId) => SUBSCRIPTION_PLANS[planId] || null;

const getPlansList = () => Object.values(SUBSCRIPTION_PLANS);

module.exports = {
  SUBSCRIPTION_PLANS,
  PAID_PLAN_IDS,
  getPlanById,
  getPlansList,
};
