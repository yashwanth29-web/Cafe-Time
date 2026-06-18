const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentConfig = require('../models/PaymentConfig');
const { decrypt } = require('../utils/encryption');

/**
 * Initialize Razorpay client dynamically per cafe.
 * Fetches credentials from database, falls back to .env if not configured.
 */
const getRazorpayInstance = async (cafeId) => {
  let keyId = process.env.RAZORPAY_KEY_ID;
  let keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (cafeId) {
    const config = await PaymentConfig.findOne({ cafeId });
    if (config && config.razorpayKeyId && config.razorpaySecretEncrypted) {
      keyId = config.razorpayKeyId;
      keySecret = decrypt(config.razorpaySecretEncrypted);
    } else {
      console.warn(`WARNING: Razorpay credentials for cafe ${cafeId} not found in DB. Falling back to .env variables.`);
    }
  }

  if (!keyId || !keySecret) {
    throw new Error('Razorpay credentials are not configured for this cafe or in the environment variables.');
  }

  return new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
};

/**
 * Fetches the public Key ID for a cafe (used for frontend checkout)
 */
const getRazorpayKeyId = async (cafeId) => {
  if (cafeId) {
    const config = await PaymentConfig.findOne({ cafeId });
    if (config && config.razorpayKeyId) {
      return config.razorpayKeyId;
    }
  }
  return process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
};

/**
 * Creates a new order in Razorpay
 * @param {string} cafeId The ID of the cafe
 * @param {number} amountInRupees Total amount in rupees
 * @returns {Promise<Object>} Created Razorpay order object
 */
const createRazorpayOrder = async (cafeId, amountInRupees) => {
  try {
    const razorpay = await getRazorpayInstance(cafeId);
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
 * @param {string} cafeId The ID of the cafe
 * @param {string} orderId Razorpay order ID
 * @param {string} paymentId Razorpay payment ID
 * @param {string} signature Razorpay signature
 * @returns {Promise<boolean>} True if signature is valid, false otherwise
 */
const verifyPaymentSignature = async (cafeId, orderId, paymentId, signature) => {
  try {
    let keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (cafeId) {
      const config = await PaymentConfig.findOne({ cafeId });
      if (config && config.razorpaySecretEncrypted) {
        keySecret = decrypt(config.razorpaySecretEncrypted);
      }
    }

    if (!keySecret) {
      throw new Error('Secret key missing for verification.');
    }

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
  verifyPaymentSignature,
  getRazorpayKeyId
};
