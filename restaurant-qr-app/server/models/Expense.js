const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    index: true
  },
  branchId: {
    type: String,
    default: 'default',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  category: {
    type: String,
    default: 'Miscellaneous',
    trim: true
  },
  paymentMode: {
    type: String,
    default: 'Cash',
    enum: ['Cash', 'Bank/UPI', 'Card', 'Other']
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  recordedBy: {
    type: String,
    default: 'Owner'
  },
  periodTag: {
    type: String,
    enum: ['Today', 'Daily', 'Weekly', '15 Days', 'Monthly', 'One-Time'],
    default: 'Today'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Expense', expenseSchema);
