import API from './api';

export const fetchPlans = async () => {
  const { data } = await API.get('/subscriptions/plans');
  return data;
};

export const fetchMySubscription = async () => {
  const { data } = await API.get('/subscriptions/me');
  return data;
};

export const createSubscriptionOrder = async (planId) => {
  const { data } = await API.post('/subscriptions/create-order', { planId });
  return data;
};

export const verifySubscriptionPayment = async (payload) => {
  const { data } = await API.post('/subscriptions/verify-payment', payload);
  return data;
};

export const fetchReceipt = async (orderId) => {
  const { data } = await API.get(`/subscriptions/receipt/${orderId}`);
  return data;
};

export const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
