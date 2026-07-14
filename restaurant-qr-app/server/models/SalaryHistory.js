const mongoose = require('mongoose');

const SalaryHistorySchema = new mongoose.Schema({
  payrollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payroll',
    required: true
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
    type: String, // "YYYY-MM-DD to YYYY-MM-DD"
    required: true
  },
  weekStart: {
    type: String,
    required: true
  },
  weekEnd: {
    type: String,
    required: true
  },
  workedDays: {
    type: Number,
    required: true
  },
  workedHours: {
    type: Number,
    required: true
  },
  grossSalary: {
    type: Number,
    required: true
  },
  deductions: {
    type: Number,
    default: 0
  },
  finalSalary: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Paid'],
    default: 'Paid'
  },
  paymentDate: {
    type: Date,
    required: true
  },
  paymentMethod: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

SalaryHistorySchema.index({ cafeId: 1, branchId: 1 });
SalaryHistorySchema.index({ employeeId: 1, weekStart: 1 });

module.exports = mongoose.model('SalaryHistory', SalaryHistorySchema);
