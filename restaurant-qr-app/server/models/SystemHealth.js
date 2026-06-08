const mongoose = require('mongoose');

const SystemHealthSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now
  },
  frontendErrors: {
    type: Number,
    default: 0
  },
  backendErrors: {
    type: Number,
    default: 0
  },
  paymentFailures: {
    type: Number,
    default: 0
  },
  printerFailures: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('SystemHealth', SystemHealthSchema);
