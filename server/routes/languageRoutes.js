const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  sendLanguageOtp,
  verifyLanguageOtp,
} = require('../controllers/languageController');

router.post('/send-otp', auth, sendLanguageOtp);
router.post('/verify-otp', auth, verifyLanguageOtp);

module.exports = router;
