const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  cafeId: {
    type: String,
    required: true,
    default: 'CD001'
  },
  branchId: {
    type: String,
    required: true,
    default: 'default'
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for multi-branch querying and sorting
NotificationSchema.index({ cafeId: 1, branchId: 1, userId: 1, isRead: 1 });
NotificationSchema.index({ cafeId: 1, branchId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);
