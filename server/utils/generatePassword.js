const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate a random password using only upper and lower case letters.
 * @param {number} length - password length (default 12)
 */
const generateLetterPassword = (length = 12) => {
  let password = '';
  for (let i = 0; i < length; i += 1) {
    const index = Math.floor(Math.random() * LETTERS.length);
    password += LETTERS[index];
  }
  return password;
};

module.exports = { generateLetterPassword };
