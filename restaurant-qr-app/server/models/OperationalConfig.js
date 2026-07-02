const mongoose = require('mongoose');

const OperationalConfigSchema = new mongoose.Schema({
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
  tables: [
    {
      id: { type: String, required: true },
      label: { type: String, required: true }
    }
  ],
  printerEnabled: {
    type: Boolean,
    default: false
  },
  kitchenDisplayEnabled: {
    type: Boolean,
    default: false
  },
  inventoryEnabled: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

OperationalConfigSchema.index({ cafeId: 1, branchId: 1 }, { unique: true });

module.exports = mongoose.model('OperationalConfig', OperationalConfigSchema);
