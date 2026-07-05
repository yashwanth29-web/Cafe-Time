const mongoose = require('mongoose');

const PayrollSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true
  },
  branchId: {
    type: String,
    required: true,
    default: 'default'
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
  employeeRole: {
    type: String,
    required: true
  },
  weekStart: {
    type: String, // YYYY-MM-DD
    required: true
  },
  weekEnd: {
    type: String, // YYYY-MM-DD
    required: true
  },
  presentDays: {
    type: Number,
    default: 0
  },
  absentDays: {
    type: Number,
    default: 0
  },
  halfDays: {
    type: Number,
    default: 0
  },
  workingHours: {
    type: Number,
    default: 0
  },
  overtimeHours: {
    type: Number,
    default: 0
  },
  salaryType: {
    type: String,
    enum: ['DAILY', 'HOURLY', 'WEEKLY', 'MONTHLY'],
    default: 'DAILY'
  },
  dailyRate: {
    type: Number,
    default: 0
  },
  hourlyRate: {
    type: Number,
    default: 0
  },
  weeklyRate: {
    type: Number,
    default: 0
  },
  monthlyRate: {
    type: Number,
    default: 0
  },
  basicSalary: {
    type: Number,
    default: 0
  },
  halfDaySalary: {
    type: Number,
    default: 0
  },
  overtimePay: {
    type: Number,
    default: 0
  },
  bonus: {
    type: Number,
    default: 0
  },
  deductions: {
    type: Number,
    default: 0
  },
  netSalary: {
    type: Number,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    default: ''
  },
  paymentDate: {
    type: Date
  },
  paidBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  remarks: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Ensure compound index for unique payroll per employee per week range
PayrollSchema.index({ employeeId: 1, weekStart: 1, weekEnd: 1 }, { unique: true });
PayrollSchema.index({ cafeId: 1, branchId: 1 });

module.exports = mongoose.model('Payroll', PayrollSchema);
