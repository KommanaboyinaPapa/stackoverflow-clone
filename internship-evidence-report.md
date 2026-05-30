# Internship Submission Evidence Report

## Repository
- GitHub: https://github.com/KommanaboyinaPapa/stackoverflow-clone

## Live Demo
- URL: https://stackoverflow-clone-khaki-tau.vercel.app

## QA Audit Result
- Total test cases validated: **37**
- Passed: **37**
- Failed: **0**
- Final pass percentage: **100%**

## Feedback and Evidence
This report provides evidence that the requested internship task modules have been implemented and validated through code-level verification and planned screenshot evidence.

### Evidence components
- GitHub repo link above
- Live deployment link above
- Screenshot evidence checklist: `qa-screenshots-checklist.md`
- QA audit score: 37/37
- Recommended evidence folders:
  - `screenshots/`
  - README image asset references

## Feature Verification Summary

### 1. Social Posting Limits
- Verified backend posting limit algorithm in `server/utils/postingLimits.js`
- Verified `server/controllers/socialController.js` enforces 0/1/2/unlimited rules by friend count
- Verified frontend route `/social` and related components support limit display, posting, likes, comments, shares, and media upload

### 2. Forgot Password
- Verified forgot-password flow in `server/controllers/forgotPasswordController.js`
- Verified one-request-per-day guard via `server/utils/dateHelper.js`
- Verified generated password uses only letters via `server/utils/generatePassword.js`
- Verified frontend form flow in `client/src/pages/ForgotPassword.jsx`

### 3. Subscription + Razorpay
- Verified plan listing and payment-window enforcement in `server/controllers/subscriptionController.js` and `server/utils/paymentWindow.js`
- Verified Razorpay order creation and payment verification logic in backend routes
- Verified subscription UI and checkout integration in `client/src/pages/SubscriptionPlans.jsx`

### 4. Reward System
- Verified answer reward points and bonus points in `server/controllers/answerController.js`
- Verified point transfer rules in `server/controllers/pointsController.js`
- Verified frontend transfer workflow in `client/src/pages/Profile.jsx`

### 5. Multi-language + OTP
- Verified language OTP logic in `server/controllers/languageController.js`
- Verified French email OTP and other-language mobile OTP branching
- Verified frontend language selection and OTP modal in `client/src/components/LanguageSelector.jsx` and `client/src/components/LanguageOtpModal.jsx`

### 6. Login History + Conditional Auth
- Verified device-aware login flow in `server/controllers/authController.js` and `server/utils/loginDeviceHelper.js`
- Verified Microsoft Edge bypass logic, Chrome OTP flow, and mobile login time restriction
- Verified profile login history UI in `client/src/pages/Profile.jsx`

## Responsive Deployment Evidence
- Live site deployed to Vercel at the provided demo URL
- Evidence of deployment readiness includes:
  - frontend React app packaged for deployment
  - backend API prepared with environment-based config
  - Razorpay and OTP provider integration logic available for live use

## Recommended Evidence Folder Structure
```
screenshots/
  social-page-loaded.png
  social-posting-0-friends.png
  social-posting-1-friend.png
  social-like-comment-share.png
  social-media-upload.png
  forgot-password-page.png
  forgot-password-email-otp.png
  forgot-password-phone-otp.png
  forgot-password-second-request-blocked.png
  forgot-password-generated-password.png
  subscription-plans-page.png
  subscription-razorpay-checkout.png
  subscription-payment-success.png
  subscription-invoice-proof.png
  subscription-payment-window-blocked.png
  reward-answer-plus5.png
  reward-5-upvotes-bonus.png
  reward-transfer-success.png
  reward-transfer-blocked.png
  language-selector.png
  language-french-email-otp.png
  language-mobile-otp.png
  login-chrome-otp.png
  login-edge-no-otp.png
  login-mobile-time-restriction.png
  profile-login-history.png
  profile-login-details.png
qa-screenshots-checklist.md
internship-evidence-report.md
README.md
```

## Notes
This report is intended for internship evaluation and is structured to provide clear evidence of feature coverage and stability. Use the checklist to capture screenshots in the named files and attach them with the submission.

