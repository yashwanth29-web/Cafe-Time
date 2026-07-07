const mongoose = require('mongoose');

const InventoryLogSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    trim: true
  },
  branchId: {
    type: String,
    required: true,
    default: 'default'
  },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    required: true
  },
  itemName: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['Purchase', 'Wastage', 'Damaged', 'Shortage', 'Deduction', 'Adjustment', 'Initial'],
    required: true
  },
  quantityChanged: {
    type: Number,
    required: true
  },
  cost: {
    type: Number,
    default: 0
  },
  reason: {
    type: String,
    default: ''
  },
  userEmail: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});


// Optimize queries bounded by branch
InventoryLogSchema.index({ cafeId: 1, branchId: 1 });

module.exports = mongoose.model('InventoryLog', InventoryLogSchema);
