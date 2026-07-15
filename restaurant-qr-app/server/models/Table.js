const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  tableId: {
    type: String,
    required: true,
    trim: true
  },
  tableNumber: {
    type: String,
    required: true,
    trim: true
  },
  branchId: {
    type: String,
    required: true,
    trim: true
  },
  cafeId: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Occupied'],
    default: 'Active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { bypassBranchFilter: true });

// Ensure unique (cafeId, branchId, tableNumber) and unique (cafeId, branchId, tableId)
TableSchema.index({ cafeId: 1, branchId: 1, tableNumber: 1 }, { unique: true });
TableSchema.index({ cafeId: 1, branchId: 1, tableId: 1 }, { unique: true });

module.exports = mongoose.model('Table', TableSchema);
