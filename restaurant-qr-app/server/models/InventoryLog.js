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
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
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
  paymentId: {
    type: String,
    default: ''
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    default: null
  },
  ingredientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    default: null
  },
  oldQuantity: {
    type: Number,
    default: 0
  },
  remainingQuantity: {
    type: Number,
    default: 0
  },
  performedBy: {
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
