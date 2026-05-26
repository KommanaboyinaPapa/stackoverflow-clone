/** True if both dates fall on the same calendar day (local server time). */
const isSameDay = (dateA, dateB) => {
  if (!dateA || !dateB) return false;
  const a = new Date(dateA);
  const b = new Date(dateB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

/** User already requested forgot-password today? */
const hasForgotPasswordToday = (lastForgotPasswordAt) =>
  isSameDay(lastForgotPasswordAt, new Date());

module.exports = { isSameDay, hasForgotPasswordToday };
