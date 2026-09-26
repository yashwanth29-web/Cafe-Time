const mongoose = require('mongoose');

const SalaryHistorySchema = new mongoose.Schema({
  payrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: false
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeName: {
    type: String,
    required: true
  },
  cafeId: {
    type: String,
    required: true
  },
  branchId: {
    type: String,
    required: true
  },
  branchName: {
    type: String,
    default: ''
  },
  payrollWeek: {
    type: String, // "YYYY-MM-DD to YYYY-MM-DD" or "Payment on YYYY-MM-DD"
    required: false,
    default: ''
  },
  weekStart: {
    type: String,
    required: false,
    default: ''
  },
  weekEnd: {
    type: String,
    required: false,
    default: ''
  },
  workedDays: {
    type: Number,
    required: false,
    default: 0
  },
  workedHours: {
    type: Number,
    required: false,
    default: 0
  },
  grossSalary: {
    type: Number,
    required: false,
    default: 0
  },
  deductions: {
    type: Number,
    default: 0
  },
  finalSalary: {
    type: Number,
    required: true
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Paid'],
    default: 'Paid'
  },
  paymentDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  paidAt: {
    type: Date,
    default: Date.now
  },
  paymentMethod: {
    type: String,
    default: 'Cash'
  },
  notes: {
    type: String,
    default: ''
  },
  payoutId: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

SalaryHistorySchema.index({ cafeId: 1, branchId: 1 });
SalaryHistorySchema.index({ employeeId: 1, weekStart: 1 });

module.exports = mongoose.model('SalaryHistory', SalaryHistorySchema);
