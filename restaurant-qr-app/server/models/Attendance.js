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
    enum: ['Present', 'Late', 'Absent'],
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
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate attendance on the same day for a staff member
AttendanceSchema.index({ staffId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
