const crypto = require('crypto');
const { getPlansList, getPlanById, PAID_PLAN_IDS } = require('../config/subscriptionPlans');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const User = require('../models/User');
const { getPaymentWindowStatus, isPaymentWindowOpen } = require('../utils/paymentWindow');
const {
  activateSubscription,
  buildSubscriptionSummary,
  getQuestionQuota,
  SUBSCRIPTION_DURATION_DAYS,
} = require('../utils/subscriptionHelper');
const { sendInvoiceEmail, isEmailConfigured } = require('../utils/emailService');

let Razorpay = null;
try {
  // eslint-disable-next-line global-require
  Razorpay = require('razorpay');
} catch {
  Razorpay = null;
}

const isRazorpayConfigured = () =>
  Boolean(
    Razorpay &&
      process.env.RAZORPAY_KEY_ID?.trim() &&
      process.env.RAZORPAY_KEY_SECRET?.trim()
  );

const getRazorpayConfigError = () => {
  const missing = [];
  if (!Razorpay) missing.push('razorpay (npm package)');
  if (!process.env.RAZORPAY_KEY_ID?.trim()) missing.push('RAZORPAY_KEY_ID');
  if (!process.env.RAZORPAY_KEY_SECRET?.trim()) missing.push('RAZORPAY_KEY_SECRET');
  if (missing.length === 0) return null;
  return {
    message: `Razorpay is not configured. Add to server/.env: ${missing.join(', ')}. Use Dashboard → Test Mode keys (rzp_test_…), then restart the server.`,
    code: 'RAZORPAY_NOT_CONFIGURED',
    missing,
  };
};

const getRazorpayInstance = () =>
  new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

const generateInvoiceNumber = (userId) => {
  const short = userId.toString().slice(-6).toUpperCase();
  return `INV-${Date.now()}-${short}`;
};

const formatLimitLabel = (limit) =>
  limit === null || limit === undefined ? 'Unlimited' : String(limit);

const buildInvoicePayload = (user, payment, plan) => ({
  invoiceNumber: payment.invoiceNumber,
  orderId: payment.orderId,
  planId: payment.planId,
  planName: plan.name,
  amountInr: payment.amountInr,
  currency: payment.currency || 'INR',
  paymentMode: payment.paymentMode,
  razorpayPaymentId: payment.razorpayPaymentId || null,
  paidAt: payment.paidAt
    ? new Date(payment.paidAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    : null,
  subscriptionStart: user.subscriptionActiveAt
    ? new Date(user.subscriptionActiveAt).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
      })
    : null,
  subscriptionExpiresAt: user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt).toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
      })
    : null,
  dailyQuestionLimit: plan.dailyQuestionLimit,
  dailyQuestionLimitLabel: formatLimitLabel(plan.dailyQuestionLimit),
  durationDays: SUBSCRIPTION_DURATION_DAYS,
  customerName: user.name,
  customerEmail: user.email,
});

const sendInvoiceIfPossible = async (user, payment, plan) => {
  const invoice = buildInvoicePayload(user, payment, plan);
  const mailResult = await sendInvoiceEmail(user.email, user.name, invoice);

  if (mailResult.sent) {
    payment.invoiceEmailPending = false;
    payment.invoiceEmailSentAt = new Date();
    await payment.save();
    return { ...invoice, emailSent: true };
  }

  return {
    ...invoice,
    emailSent: false,
    emailPending: true,
    receiptNote: isEmailConfigured()
      ? 'Invoice email could not be sent. Download receipt details below.'
      : 'Email not configured — use the receipt details below (demo mode).',
  };
};

// GET /api/subscriptions/plans
exports.getPlans = async (req, res) => {
  try {
    const paymentWindow = getPaymentWindowStatus();
    res.json({
      plans: getPlansList(),
      paymentWindow,
      razorpayEnabled: isRazorpayConfigured(),
      emailConfigured: isEmailConfigured(),
    });
  } catch (error) {
    console.error('getPlans error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/subscriptions/me
exports.getMySubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const subscription = buildSubscriptionSummary(user);
    const quota = await getQuestionQuota(user);
    const paymentWindow = getPaymentWindowStatus();

    res.json({
      subscription,
      quota,
      paymentWindow,
      razorpayEnabled: isRazorpayConfigured(),
      emailConfigured: isEmailConfigured(),
    });
  } catch (error) {
    console.error('getMySubscription error:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/subscriptions/receipt/:orderId
exports.getReceipt = async (req, res) => {
  try {
    const payment = await SubscriptionPayment.findOne({
      orderId: req.params.orderId,
      user: req.user._id,
      status: 'paid',
    });

    if (!payment) {
      return res.status(404).json({ message: 'Receipt not found.' });
    }

    const user = await User.findById(req.user._id);
    const plan = getPlanById(payment.planId);
    const invoice = buildInvoicePayload(user, payment, plan);

    res.json({
      success: true,
      invoice,
      downloadable: true,
    });
  } catch (error) {
    console.error('getReceipt error:', error.message);
    res.status(500).json({ message: 'Could not load receipt.' });
  }
};

// POST /api/subscriptions/create-order
exports.createOrder = async (req, res) => {
  try {
    const { planId } = req.body;

    if (!PAID_PLAN_IDS.includes(planId)) {
      return res.status(400).json({ message: 'Invalid subscription plan.' });
    }

    const plan = getPlanById(planId);
    const paymentWindow = getPaymentWindowStatus();

    if (!paymentWindow.open) {
      return res.status(403).json({
        message: paymentWindow.message,
        paymentWindow,
        code: 'PAYMENT_WINDOW_CLOSED',
      });
    }

    const razorpayError = getRazorpayConfigError();
    if (razorpayError) {
      return res.status(503).json(razorpayError);
    }

    const amountPaise = plan.priceInr * 100;
    const internalOrderId = `ord_${crypto.randomBytes(12).toString('hex')}`;

    const razorpay = getRazorpayInstance();
    const rzOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: internalOrderId,
      notes: { planId, userId: req.user._id.toString() },
    });

    const razorpayOrderId = rzOrder.id;
    const mode = 'razorpay';

    await SubscriptionPayment.create({
      user: req.user._id,
      planId,
      amountInr: plan.priceInr,
      currency: 'INR',
      paymentMode: mode,
      status: 'created',
      orderId: internalOrderId,
      razorpayOrderId,
      invoiceNumber: generateInvoiceNumber(req.user._id),
      invoiceEmailPending: true,
      metadata: {
        planName: plan.name,
        dailyQuestionLimit: plan.dailyQuestionLimit,
      },
    });

    res.json({
      mode,
      orderId: internalOrderId,
      razorpayOrderId: razorpayOrderId || null,
      amount: amountPaise,
      currency: 'INR',
      planId,
      planName: plan.name,
      keyId: mode === 'razorpay' ? process.env.RAZORPAY_KEY_ID : null,
      paymentWindow,
      razorpayTestMode: process.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_'),
    });
  } catch (error) {
    console.error('Create-order error:', error);
    const razorpayMessage =
      error?.error?.description ||
      error?.error?.reason ||
      error?.description ||
      error?.message;
    res.status(500).json({
      message: razorpayMessage || 'Could not create payment order.',
    });
  }
};

const completePayment = async (paymentRecord, extra = {}) => {
  paymentRecord.status = 'paid';
  paymentRecord.paidAt = new Date();
  if (extra.razorpayPaymentId) paymentRecord.razorpayPaymentId = extra.razorpayPaymentId;
  if (extra.razorpaySignature) paymentRecord.razorpaySignature = extra.razorpaySignature;

  const user = await User.findById(paymentRecord.user);
  activateSubscription(user, paymentRecord.planId);
  await user.save();

  const plan = getPlanById(paymentRecord.planId);
  paymentRecord.metadata = {
    ...paymentRecord.metadata,
    planName: plan.name,
    dailyQuestionLimit: plan.dailyQuestionLimit,
    subscriptionStart: user.subscriptionActiveAt,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  };
  await paymentRecord.save();

  const invoice = await sendInvoiceIfPossible(user, paymentRecord, plan);

  return { user, payment: paymentRecord, invoice };
};

const verifyRazorpaySignature = (orderId, paymentId, signature) => {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return expected === signature;
};

// POST /api/subscriptions/verify-payment
exports.verifyPayment = async (req, res) => {
  try {
    if (!isPaymentWindowOpen()) {
      const paymentWindow = getPaymentWindowStatus();
      return res.status(403).json({
        message: paymentWindow.message,
        paymentWindow,
        code: 'PAYMENT_WINDOW_CLOSED',
      });
    }

    const {
      orderId,
      planId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
    } = req.body;

    const razorpayError = getRazorpayConfigError();
    if (razorpayError) {
      return res.status(503).json(razorpayError);
    }

    const payment = await SubscriptionPayment.findOne({
      orderId,
      user: req.user._id,
      status: 'created',
    });

    if (!payment) {
      return res.status(404).json({ message: 'Payment order not found or already processed.' });
    }

    if (payment.planId !== planId) {
      return res.status(400).json({ message: 'Plan mismatch for this order.' });
    }

    if (payment.paymentMode !== 'razorpay') {
      return res.status(400).json({
        message:
          'This order was not created for Razorpay checkout. Create a new order after configuring RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.',
        code: 'INVALID_PAYMENT_MODE',
      });
    }

    if (!razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ message: 'Razorpay payment details required.' });
    }

    const resolvedOrderId = razorpayOrderId || payment.razorpayOrderId;
    if (resolvedOrderId !== payment.razorpayOrderId) {
      return res.status(400).json({ message: 'Order ID mismatch.' });
    }

    if (!verifyRazorpaySignature(resolvedOrderId, razorpayPaymentId, razorpaySignature)) {
      payment.status = 'failed';
      await payment.save();
      return res.status(400).json({ message: 'Payment signature verification failed.' });
    }

    try {
      const razorpay = getRazorpayInstance();
      const rzPayment = await razorpay.payments.fetch(razorpayPaymentId);
      if (rzPayment.status !== 'captured') {
        return res.status(400).json({
          message: `Payment not captured (status: ${rzPayment.status}).`,
        });
      }
      if (rzPayment.order_id !== payment.razorpayOrderId) {
        return res.status(400).json({ message: 'Razorpay order mismatch.' });
      }
      if (Number(rzPayment.amount) !== payment.amountInr * 100) {
        return res.status(400).json({ message: 'Payment amount mismatch.' });
      }
    } catch (fetchErr) {
      console.error('Razorpay fetch warning:', fetchErr.message);
    }

    const { user, payment: paid, invoice } = await completePayment(payment, {
      razorpayPaymentId,
      razorpaySignature,
    });
    const plan = getPlanById(payment.planId);

    return res.json({
      success: true,
      message: `Successfully subscribed to ${plan.name}! Your plan is active for 30 days.`,
      subscription: buildSubscriptionSummary(user),
      quota: await getQuestionQuota(user),
      invoice,
      receiptDownloadUrl: `/api/subscriptions/receipt/${paid.orderId}`,
    });
  } catch (error) {
    console.error('verifyPayment error:', error.message);
    res.status(500).json({ message: 'Payment verification failed.' });
  }
};
