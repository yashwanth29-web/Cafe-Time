const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
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
  displayOrder: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

// Compound index to ensure unique category name per branch
CategorySchema.index({ name: 1, cafeId: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model('Category', CategorySchema);
