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
  latitude: {
    type: Number,
    default: 0
  },
  longitude: {
    type: Number,
    default: 0
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
  gstRate: {
    type: Number,
    default: 0
  },
  serviceChargeRate: {
    type: Number,
    default: 0
  },
  subscriptionPlan: {
    type: String,
    enum: ['Basic', 'Premium', 'Enterprise'],
    default: 'Basic'
  },
  subscriptionStatus: {
    type: String,
    enum: ['Active', 'Suspended', 'Expired'],
    default: 'Active'
  },
  subscriptionRenewal: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Cafe', CafeSchema);
