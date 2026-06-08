const mongoose = require('mongoose');

const OperationalConfigSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    unique: true,
    trim: true
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

module.exports = mongoose.model('OperationalConfig', OperationalConfigSchema);
