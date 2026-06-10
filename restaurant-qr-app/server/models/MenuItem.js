const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
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
  category: {
    type: String,
    required: true,
    trim: true
  },
  available: {
    type: Boolean,
    default: true
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

module.exports = mongoose.model('MenuItem', MenuItemSchema);
