const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

exports.validateRegister = ({ name, email, password }) => {
  const errors = [];

  if (!name?.trim()) errors.push('Name is required');
  else if (name.trim().length > 80) errors.push('Name must be 80 characters or less');

  if (!email?.trim()) errors.push('Email is required');
  else if (!EMAIL_REGEX.test(email.trim())) errors.push('Please provide a valid email');

  if (!password) errors.push('Password is required');
  else if (password.length < 8) errors.push('Password must be at least 8 characters');

  return errors;
};

exports.validateLogin = ({ email, password }) => {
  const errors = [];

  if (!email?.trim()) errors.push('Email is required');
  if (!password) errors.push('Password is required');

  return errors;
};
