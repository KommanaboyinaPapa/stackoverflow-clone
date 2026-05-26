const mongoose = require('mongoose');

/**
 * Payment records — supports demo + Razorpay and future invoice/email.
 */
const subscriptionPaymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: String,
      required: true,
      enum: ['bronze', 'silver', 'gold'],
    },
    amountInr: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    paymentMode: {
      type: String,
      enum: ['demo', 'razorpay'],
      required: true,
    },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed'],
      default: 'created',
    },
    orderId: { type: String, required: true, index: true },
    razorpayOrderId: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    /** Prepared for invoice generation */
    invoiceNumber: { type: String, default: '' },
    invoiceEmailPending: { type: Boolean, default: true },
    invoiceEmailSentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SubscriptionPayment', subscriptionPaymentSchema);
