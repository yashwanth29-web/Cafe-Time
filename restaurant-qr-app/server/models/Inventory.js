const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    trim: true,
    default: 'CD001'
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
  },
  stock: {
    type: Number,
    required: true,
    default: 0
  },
  unit: {
    type: String,
    required: true,
    trim: true
  },
  costPrice: {
    type: Number,
    required: true,
    default: 0
  },
  cost: {
    type: Number,
    required: true,
    default: 0
  },
  sellingPrice: {
    type: Number,
    required: true,
    default: 0
  },
  supplier: {
    type: String,
    default: '',
    trim: true
  },
  branch: {
    type: String,
    default: 'Main',
    trim: true
  },
  reorderLevel: {
    type: Number,
    required: true,
    default: 0
  },
  minStock: {
    type: Number,
    required: true,
    default: 0
  },
  category: {
    type: String,
    default: 'Ingredients',
    trim: true
  },
  status: {
    type: String,
    enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'],
    default: 'IN_STOCK'
  }
}, {
  timestamps: true
});

// Pre-save hook to synchronize backward compatibility fields (stock/minStock/cost)
InventorySchema.pre('save', function(next) {
  this.stock = this.quantity;
  this.minStock = this.reorderLevel;
  this.cost = this.costPrice;
  
  if (this.quantity <= 0) {
    this.status = 'OUT_OF_STOCK';
  } else if (this.quantity <= this.reorderLevel) {
    this.status = 'LOW_STOCK';
  } else {
    this.status = 'IN_STOCK';
  }
  next();
});

module.exports = mongoose.model('Inventory', InventorySchema);
