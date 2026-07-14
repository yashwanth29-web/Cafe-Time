const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  staffName: {
    type: String,
    required: true
  },
  branchId: {
    type: String,
    required: true
  },
  branchName: {
    type: String,
    required: true
  },
  cafeId: {
    type: String,
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true
  },
  checkInTime: {
    type: Date,
    required: true
  },
  checkOutTime: {
    type: Date
  },
  totalDuration: {
    type: Number, // in minutes
    default: 0
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  distanceFromCafe: {
    type: Number, // in meters
    required: true
  },
  deviceInfo: {
    type: String,
    default: 'Unknown Device'
  },
  status: {
    type: String,
    enum: ['Present', 'Late', 'Absent', 'Half Day', 'Leave', 'Holiday'],
    default: 'Present'
  },

  image: {
    type: String,
    default: ''
  },
  gridFsFileId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  gridFsFilename: {
    type: String,
    default: ''
  },
  imageExpired: {
    type: Boolean,
    default: false
  },
  imageExpiredAt: {
    type: Date,
    default: null
  },
  workingHours: {
    type: Number,
    default: 0
  },
  overtimeHours: {
    type: Number,
    default: 0
  },
  isExtraWorkActive: {
    type: Boolean,
    default: false
  },
  extraWorkStartTime: {
    type: Date
  },
  extraWorkEndTime: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate attendance on the same day for a staff member
AttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ cafeId: 1, date: -1 });
AttendanceSchema.index({ cafeId: 1, branchId: 1, date: -1 });


// Optimize queries bounded by branch
AttendanceSchema.index({ cafeId: 1, branchId: 1 });

// Post-save hook to automatically trigger recalculation
AttendanceSchema.post('save', async function(doc) {
  try {
    const { recalculateStaffSalary } = require('../services/payrollService');
    await recalculateStaffSalary(doc.staffId);
  } catch (err) {
    console.error('Error in post-save attendance hook:', err);
  }
});

// Post-findOneAndUpdate hook
AttendanceSchema.post('findOneAndUpdate', async function(doc) {
  if (doc && doc.staffId) {
    try {
      const { recalculateStaffSalary } = require('../services/payrollService');
      await recalculateStaffSalary(doc.staffId);
    } catch (err) {
      console.error('Error in post-findOneAndUpdate attendance hook:', err);
    }
  }
});

// Post-findOneAndDelete hook
AttendanceSchema.post('findOneAndDelete', async function(doc) {
  if (doc && doc.staffId) {
    try {
      const { recalculateStaffSalary } = require('../services/payrollService');
      await recalculateStaffSalary(doc.staffId);
    } catch (err) {
      console.error('Error in post-findOneAndDelete attendance hook:', err);
    }
  }
});

module.exports = mongoose.model('Attendance', AttendanceSchema);
