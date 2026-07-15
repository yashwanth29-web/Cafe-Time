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
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  status: {
    type: String,
    default: 'ACTIVE'
  }
}, {
  timestamps: true
});

// Unique index for category per branch
InventoryCategorySchema.index({ name: 1, cafeId: 1, branchId: 1 }, { unique: true });
InventoryCategorySchema.index({ cafeId: 1, branchId: 1 });

module.exports = mongoose.model('InventoryCategory', InventoryCategorySchema);
