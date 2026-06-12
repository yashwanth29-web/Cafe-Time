const mongoose = require('mongoose');

const BranchSchema = new mongoose.Schema({
  branchId: {
    type: String,
    required: true,
    unique: true,
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
    default: 30
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Branch', BranchSchema);
