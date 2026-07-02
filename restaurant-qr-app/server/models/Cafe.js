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
  uiPrimaryColor: {
    type: String,
    default: '#D47F46' // Default coffee orange color
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
  gstRate: {
    type: Number,
    default: 0
  },
  serviceChargeRate: {
    type: Number,
    default: 0
  },
  supportNumber: {
    type: String,
    default: ''
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
  requiredDailyHours: {
    type: Number,
    default: 8
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Cafe', CafeSchema, 'cafes');
