/**
 * Turn axios/API errors into friendly messages for the UI.
 */
const getErrorMessage = (err, fallback = 'Something went wrong. Please try again.') => {
  if (!err) return fallback;

  const message = err.response?.data?.message;
  if (message) return message;

  const status = err.response?.status;
  if (status === 401) return 'Please log in to continue.';
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'The requested item was not found.';
  if (status >= 500) return 'Server error. Please try again later.';

  if (!err.response) {
    return 'Cannot reach the server. Make sure the backend is running on port 5000.';
  }

  return fallback;
};

export default getErrorMessage;
