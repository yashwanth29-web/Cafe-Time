const mongoose = require('mongoose');

const cashRegisterSchema = new mongoose.Schema({
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
  date: {
    type: String, // format YYYY-MM-DD
    required: true,
    index: true
  },
  yesterdayCash: {
    type: Number,
    default: 0
  },
  todayCash: {
    type: Number,
    default: 0
  },
  bankBalance: {
    type: Number,
    default: 0
  },
  purchasesAmount: {
    type: Number,
    default: 0
  },
  purchasesNote: {
    type: String,
    default: '',
    trim: true
  },
  netCashInHand: {
    type: Number,
    default: 0
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  updatedBy: {
    type: String,
    default: 'Owner'
  }
}, {
  timestamps: true
});

// Ensure compound index on cafeId, branchId, and date
cashRegisterSchema.index({ cafeId: 1, branchId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('CashRegister', cashRegisterSchema);
