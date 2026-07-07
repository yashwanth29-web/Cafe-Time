const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  branchId: {
    type: String,
    required: true,
    trim: true
  },
  branchName: {
    type: String,
    required: true,
    trim: true
  },
  cafeId: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  manager: {
    type: String,
    default: ''
  },
  latitude: {
    type: Number,
    default: 0
  },
  longitude: {
    type: Number,
    default: 0
  },
  allowedRadius: {
    type: Number,
    default: 100
  },
  city: {
    type: String,
    default: ''
  },
  state: {
    type: String,
    default: ''
  },
  pincode: {
    type: String,
    default: ''
  },
  googleMapsUrl: {
    type: String,
    default: ''
  },
  openingTime: {
    type: String,
    default: '09:00 AM'
  },
  closingTime: {
    type: String,
    default: '10:00 PM'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  unifiedStaffMode: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { bypassBranchFilter: true });

BranchSchema.index({ branchId: 1, cafeId: 1 }, { unique: true });

module.exports = mongoose.model('Branch', BranchSchema);
