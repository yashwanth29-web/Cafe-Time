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
});

// Compound index to prevent duplicate attendance on the same day for a staff member
AttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });
AttendanceSchema.index({ cafeId: 1, date: -1 });
AttendanceSchema.index({ cafeId: 1, branchId: 1, date: -1 });


// Optimize queries bounded by branch
AttendanceSchema.index({ cafeId: 1, branchId: 1 });

module.exports = mongoose.model('Attendance', AttendanceSchema);
