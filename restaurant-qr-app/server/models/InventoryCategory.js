const mongoose = require('mongoose');

const InventoryCategorySchema = new mongoose.Schema({
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
  }
}, {
  timestamps: true
});

// Unique index for category per branch
InventoryCategorySchema.index({ name: 1, cafeId: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model('InventoryCategory', InventoryCategorySchema);
