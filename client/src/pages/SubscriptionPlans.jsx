import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createSubscriptionOrder,
  fetchMySubscription,
  fetchPlans,
  loadRazorpayScript,
  verifySubscriptionPayment,
} from '../services/subscriptionService';
import { useLanguage } from '../context/LanguageContext';
import getErrorMessage from '../utils/getErrorMessage';
import '../styles/subscription.css';

const planTierClass = {
  free: '',
  bronze: 'plan-bronze',
  silver: 'plan-silver',
  gold: 'plan-gold featured',
};

const formatLimit = (limit) =>
  limit === null || limit === undefined ? 'Unlimited questions / day' : `${limit} question${limit !== 1 ? 's' : ''} / day`;

const SubscriptionPlans = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [plans, setPlans] = useState([]);
  const [paymentWindow, setPaymentWindow] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [quota, setQuota] = useState(null);
  const [razorpayEnabled, setRazorpayEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payingPlan, setPayingPlan] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastInvoice, setLastInvoice] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const plansData = await fetchPlans();
      setPlans(plansData.plans || []);
      setPaymentWindow(plansData.paymentWindow);
      setRazorpayEnabled(plansData.razorpayEnabled);

      if (isAuthenticated) {
        const me = await fetchMySubscription();
        setSubscription(me.subscription);
        setQuota(me.quota);
        setPaymentWindow(me.paymentWindow);
        setRazorpayEnabled(me.razorpayEnabled);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load subscription plans.'));
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatRazorpayError = (err, order) => {
    const data = err?.response?.data;
    if (data?.missing?.length) {
      return `${data.message} (Missing: ${data.missing.join(', ')})`;
    }
    if (data?.message) return data.message;
    if (order && order.mode !== 'razorpay') {
      return 'Razorpay order was not created. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env and restart the server.';
    }
    return getErrorMessage(err, 'Payment failed.');
  };

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/subscriptions', message: 'Log in to subscribe.' } });
      return;
    }

    if (!razorpayEnabled) {
      setError(
        'Razorpay is not configured on the server. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (rzp_test_…) to server/.env, then restart npm run dev.'
      );
      return;
    }

    setPayingPlan(planId);
    setError('');
    setSuccess('');
    setLastInvoice(null);

    try {
      const order = await createSubscriptionOrder(planId);

      if (order.mode !== 'razorpay' || !order.razorpayOrderId || !order.keyId) {
        setError(
          'Razorpay checkout unavailable: server did not return order_id or keyId. Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env.'
        );
        setPayingPlan('');
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        setError(
          'Could not load Razorpay checkout script (https://checkout.razorpay.com/v1/checkout.js). Check your network or ad blocker.'
        );
        setPayingPlan('');
        return;
      }

      const plan = plans.find((p) => p.id === planId);
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'StackClone',
        description: `${plan?.name || planId} Subscription`,
        order_id: order.razorpayOrderId,
        handler: async (response) => {
          try {
            const result = await verifySubscriptionPayment({
              orderId: order.orderId,
              planId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setSuccess(result.message);
            setSubscription(result.subscription);
            setQuota(result.quota);
            setLastInvoice(result.invoice || null);
            await loadData();
          } catch (err) {
            setError(formatRazorpayError(err));
          } finally {
            setPayingPlan('');
          }
        },
        modal: {
          ondismiss: () => setPayingPlan(''),
        },
        theme: { color: '#f48225' },
      });
      rzp.on('payment.failed', (resp) => {
        setError(
          resp?.error?.description ||
            resp?.error?.reason ||
            'Razorpay payment failed. Please try again.'
        );
        setPayingPlan('');
      });
      rzp.open();
    } catch (err) {
      setError(formatRazorpayError(err));
      if (err.response?.data?.paymentWindow) {
        setPaymentWindow(err.response.data.paymentWindow);
      }
      setPayingPlan('');
    }
  };

  const currentPlanId = subscription?.planId || 'free';
  const windowOpen = paymentWindow?.open;

  return (
    <div className="page subscription-page">
      <div className="page-content subscription-page-inner">
        <div className="subscription-hero">
          <h1>{t('subscription.title')}</h1>
          <p>{t('subscription.subtitle')}</p>
        </div>

        {isAuthenticated && subscription && (
          <div className="subscription-status-bar">
            <span>
              Current plan: <strong>{subscription.planName}</strong>
            </span>
            {quota && (
              <span>
                Today: <strong>{quota.usedToday}</strong>
                {quota.unlimited ? ' / ∞' : ` / ${quota.dailyLimit}`} questions
              </span>
            )}
            {subscription.subscriptionExpiresAt && subscription.planId !== 'free' && (
              <span>
                Renews until:{' '}
                <strong>
                  {new Date(subscription.subscriptionExpiresAt).toLocaleDateString()}
                </strong>
              </span>
            )}
          </div>
        )}

        {paymentWindow && (
          <div
            className={`subscription-window-alert ${windowOpen ? 'open' : 'closed'}`}
            role="status"
          >
            <strong>
              {windowOpen ? 'Payment window open' : 'Payment window closed'}
            </strong>
            {' — '}
            {paymentWindow.message}
            {paymentWindow.istTimeLabel && (
              <span> (Current IST: {paymentWindow.istTimeLabel})</span>
            )}
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}
        {success && (
          <div className="subscription-success-panel">
            <h3>Subscription activated</h3>
            <p>{success}</p>
            {lastInvoice && (
              <div className="subscription-receipt-card">
                <h4>Invoice / Receipt</h4>
                <dl className="receipt-details">
                  <dt>Invoice #</dt>
                  <dd>{lastInvoice.invoiceNumber}</dd>
                  <dt>Plan</dt>
                  <dd>{lastInvoice.planName}</dd>
                  <dt>Amount</dt>
                  <dd>₹{lastInvoice.amountInr}</dd>
                  <dt>Paid</dt>
                  <dd>{lastInvoice.paidAt}</dd>
                  <dt>Valid until</dt>
                  <dd>{lastInvoice.subscriptionExpiresAt}</dd>
                  <dt>Questions / day</dt>
                  <dd>{lastInvoice.dailyQuestionLimitLabel}</dd>
                </dl>
                {lastInvoice.emailSent ? (
                  <p className="receipt-note success-note">
                    Invoice emailed to {lastInvoice.customerEmail}.
                  </p>
                ) : (
                  <p className="receipt-note">
                    {lastInvoice.receiptNote ||
                      'Save these details — demo receipt (configure EMAIL_USER for invoice email).'}
                  </p>
                )}
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    const text = [
                      `StackClone Invoice`,
                      `Invoice: ${lastInvoice.invoiceNumber}`,
                      `Plan: ${lastInvoice.planName}`,
                      `Amount: ₹${lastInvoice.amountInr}`,
                      `Paid: ${lastInvoice.paidAt}`,
                      `Expires: ${lastInvoice.subscriptionExpiresAt}`,
                      `Limit: ${lastInvoice.dailyQuestionLimitLabel}/day`,
                    ].join('\n');
                    const blob = new Blob([text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${lastInvoice.invoiceNumber}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download receipt (.txt)
                </button>
              </div>
            )}
            <Link to="/ask" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Ask a Question
            </Link>
          </div>
        )}

        {loading ? (
          <div className="social-loading">
            <div className="loading-spinner" />
            <p>Loading plans…</p>
          </div>
        ) : (
          <div className="subscription-pricing-grid">
            {plans.map((plan) => {
              const isCurrent = currentPlanId === plan.id;
              const isFree = plan.id === 'free';

              return (
                <article
                  key={plan.id}
                  className={`pricing-card ${planTierClass[plan.id] || ''} ${isCurrent ? 'current' : ''}`}
                >
                  {plan.id === 'gold' && !isCurrent && (
                    <span className="pricing-badge">Popular</span>
                  )}
                  {isCurrent && (
                    <span className="pricing-badge current-badge">Current</span>
                  )}
                  <p className="pricing-tier">{plan.name}</p>
                  <h2>{plan.name}</h2>
                  <p className="pricing-desc">{plan.description}</p>
                  <div className="pricing-price">
                    {plan.priceInr === 0 ? (
                      <span className="amount">Free</span>
                    ) : (
                      <>
                        <span className="amount">₹{plan.priceInr}</span>
                        <span className="period"> / month</span>
                      </>
                    )}
                  </div>
                  <span className="pricing-limit">{formatLimit(plan.dailyQuestionLimit)}</span>
                  <ul className="pricing-features">
                    {plan.features?.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  {isFree ? (
                    <button type="button" className="btn btn-outline" disabled={isCurrent}>
                      {isCurrent ? 'Current plan' : 'Default plan'}
                    </button>
                  ) : !isAuthenticated ? (
                    <Link
                      to="/login"
                      state={{ from: '/subscriptions' }}
                      className="btn btn-primary"
                    >
                      Log in to subscribe
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={
                        isCurrent ||
                        payingPlan === plan.id ||
                        !windowOpen ||
                        !razorpayEnabled
                      }
                      onClick={() => handleSubscribe(plan.id)}
                    >
                      {payingPlan === plan.id
                        ? 'Processing…'
                        : isCurrent
                          ? 'Current plan'
                          : !razorpayEnabled
                            ? 'Razorpay not configured'
                          : windowOpen
                            ? 'Subscribe now'
                            : 'Unavailable now'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <p className="subscription-payment-note">
          {razorpayEnabled
            ? 'Razorpay TEST MODE checkout enabled. Use test card 4111 4111 4111 1111, any future expiry/CVV.'
            : 'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (rzp_test_…) to server/.env and restart the server.'}
          {' '}
          Payments only 10:00–11:00 AM IST. Invoices emailed when EMAIL_USER/EMAIL_PASS is configured; otherwise download receipt after pay.
        </p>

        {!isAuthenticated && (
          <p className="auth-footer" style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default SubscriptionPlans;
