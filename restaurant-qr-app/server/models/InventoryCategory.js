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
  }
}, {
  timestamps: true
});

// Unique index for category per cafe
InventoryCategorySchema.index({ name: 1, cafeId: 1 }, { unique: true });

module.exports = mongoose.model('InventoryCategory', InventoryCategorySchema);
