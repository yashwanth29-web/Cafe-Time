const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay client. Lazily loaded or fallback to default credentials.
const getRazorpayInstance = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.warn('WARNING: Razorpay environment credentials are not fully configured. Using fallback values.');
  }

  return new Razorpay({
    key_id: keyId || 'rzp_test_placeholder',
    key_secret: keySecret || 'secret_placeholder'
  });
};

/**
 * Creates a new order in Razorpay
 * @param {number} amountInRupees Total amount in rupees
 * @returns {Promise<Object>} Created Razorpay order object
 */
const createRazorpayOrder = async (amountInRupees) => {
  try {
    const razorpay = getRazorpayInstance();
    const amountInPaise = Math.round(amountInRupees * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    };

    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Error creating order in Razorpay service:', error);
    throw error;
  }
};

/**
 * Verifies Razorpay payment signature
 * @param {string} orderId Razorpay order ID
 * @param {string} paymentId Razorpay payment ID
 * @param {string} signature Razorpay signature
 * @returns {boolean} True if signature is valid, false otherwise
 */
const verifyPaymentSignature = (orderId, paymentId, signature) => {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder';
    const text = `${orderId}|${paymentId}`;

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(text)
      .digest('hex');

    return expectedSignature === signature;
  } catch (error) {
    console.error('Error verifying Razorpay signature:', error);
    return false;
  }
};

module.exports = {
  createRazorpayOrder,
  verifyPaymentSignature
};
