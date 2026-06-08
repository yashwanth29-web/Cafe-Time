const mongoose = require('mongoose');

const CafeSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  ownerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // V2 Registration fields
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
  businessType: {
    type: String,
    enum: ['Cafe', 'Restaurant', 'Bakery', 'Cloud Kitchen'],
    default: 'Cafe'
  },
  branchCount: {
    type: Number,
    default: 1
  },
  setupCompleted: {
    type: Boolean,
    default: false
  },
  // V2 Setup fields
  logoUrl: {
    type: String,
    default: ''
  },
  address: {
    type: String,
    default: ''
  },
  mapsLocation: {
    type: String,
    default: ''
  },
  openingTime: {
    type: String,
    default: ''
  },
  closingTime: {
    type: String,
    default: ''
  },
  gstNumber: {
    type: String,
    default: ''
  },
  supportNumber: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Cafe', CafeSchema);
