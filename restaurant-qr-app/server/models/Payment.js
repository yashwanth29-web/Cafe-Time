const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    trim: true
  },
  orderId: {
    type: String,
    required: true,
    trim: true
  },
  appOrderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    required: true,
    default: 'success'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { bypassBranchFilter: true });

module.exports = mongoose.model('Payment', PaymentSchema);
