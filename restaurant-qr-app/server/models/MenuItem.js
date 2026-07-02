const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
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
  name: {
    type: String,
    required: true,
    trim: true
  },
  image: {
    type: String,
    default: '/images/default-food.png'
  },
  price: {
    type: Number,
    required: true
  },
  originalPrice: {
    type: Number,
    required: false
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  available: {
    type: Boolean,
    default: true
  },
  isCombo: {
    type: Boolean,
    default: false
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  preparationTime: {
    type: Number,
    default: 10
  },
  recipe: [{
    name: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

MenuItemSchema.index({ cafeId: 1, branchId: 1, category: 1 });
MenuItemSchema.index({ cafeId: 1, branchId: 1, name: 1 });

// Optimize queries bounded by branch
MenuItemSchema.index({ cafeId: 1, branchId: 1 });

module.exports = mongoose.model('MenuItem', MenuItemSchema);
