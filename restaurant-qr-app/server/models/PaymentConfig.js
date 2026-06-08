const mongoose = require('mongoose');

const PaymentConfigSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  razorpayKeyId: {
    type: String,
    default: ''
  },
  razorpaySecretEncrypted: {
    type: String,
    default: ''
  },
  upiId: {
    type: String,
    default: '',
    trim: true
  },
  bankHolderName: {
    type: String,
    default: '',
    trim: true
  },
  accountNumber: {
    type: String,
    default: '',
    trim: true
  },
  ifscCode: {
    type: String,
    default: '',
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PaymentConfig', PaymentConfigSchema);
