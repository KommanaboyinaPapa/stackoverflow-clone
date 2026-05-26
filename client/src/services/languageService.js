import API from './api';

export const sendLanguageOtp = async (language) => {
  const { data } = await API.post('/language/send-otp', { language });
  return data;
};

export const verifyLanguageOtp = async ({ language, otp }) => {
  const { data } = await API.post('/language/verify-otp', { language, otp });
  return data;
};
