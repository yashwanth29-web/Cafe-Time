const mongoose = require('mongoose');

const PaymentConfigSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    trim: true
  },
  branchId: {
    type: String,
    required: true,
    default: 'default',
    trim: true
  },
  acceptCash: {
    type: Boolean,
    default: true
  },
  enableUpi: {
    type: Boolean,
    default: true
  },
  taxRate: {
    type: Number,
    default: 0
  },
  platformCharge: {
    type: Number,
    default: 0
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
  paymentInstructions: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

PaymentConfigSchema.index({ cafeId: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model('PaymentConfig', PaymentConfigSchema);
