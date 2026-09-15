const mongoose = require('mongoose');

const ReviewItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  }
}, { _id: false, bypassBranchFilter: true });

const ReviewSchema = new mongoose.Schema({
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
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  customerName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  reviewText: {
    type: String,
    default: ''
  },
  orderedItems: {
    type: [ReviewItemSchema],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

ReviewSchema.index({ cafeId: 1, createdAt: -1 });
ReviewSchema.index({ cafeId: 1, branchId: 1 });

module.exports = mongoose.model('Review', ReviewSchema);
