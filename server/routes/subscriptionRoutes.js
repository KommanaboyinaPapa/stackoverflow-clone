const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getPlans,
  getMySubscription,
  getReceipt,
  createOrder,
  verifyPayment,
} = require('../controllers/subscriptionController');

router.get('/plans', getPlans);
router.get('/me', auth, getMySubscription);
router.get('/receipt/:orderId', auth, getReceipt);
router.post('/create-order', auth, createOrder);
router.post('/verify-payment', auth, verifyPayment);

module.exports = router;
