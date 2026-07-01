const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    unique: true,
    sparse: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'staff', 'OWNER', 'MANAGER', 'CHEF', 'WAITER', 'CASHIER'],
    default: 'staff'
  },
  staffRole: {
    type: String,
    default: ''
  },
  employeeId: {
    type: String,
    unique: true,
    sparse: true
  },
  assignedBranch: {
    type: String,
    default: ''
  },
  cafeId: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
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
  weeklyOff: {
    type: String,
    default: 'Sunday'
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  salaryStatus: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  lastLogin: {
    type: Date
  },
  lastSeen: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);
