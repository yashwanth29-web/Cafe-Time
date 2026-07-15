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
  menuId: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: '/images/default-food.png'
  },
  imagePath: {
    type: String,
    default: '/images/default-food.png'
  },
  imageKey: {
    type: String,
    default: ''
  },
  uploadedBy: {
    type: String,
    default: 'system'
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
    },
    unit: {
      type: String,
      default: ''
    }
  }],
  masterItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    default: null
  },
  isHidden: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

MenuItemSchema.index({ category: 1, name: 1 });
MenuItemSchema.index({ available: 1 });
MenuItemSchema.index({ cafeId: 1, branchId: 1, category: 1 });
MenuItemSchema.index({ cafeId: 1, branchId: 1, name: 1 });
MenuItemSchema.index({ cafeId: 1, branchId: 1 });

MenuItemSchema.pre('save', function(next) {
  if (!this.menuId) {
    this.menuId = this._id.toString();
  }
  if (this.image) {
    if (!this.imageUrl || this.imageUrl === '/images/default-food.png') this.imageUrl = this.image;
    if (!this.imagePath || this.imagePath === '/images/default-food.png') this.imagePath = this.image;
    if (!this.imageKey) {
      try {
        this.imageKey = this.image.split('/').pop();
      } catch (e) {
        this.imageKey = '';
      }
    }
  }
  if (typeof next === 'function') {
    next();
  }
});

MenuItemSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  if (update) {
    if (update.image) {
      update.imageUrl = update.image;
      update.imagePath = update.image;
      try {
        update.imageKey = update.image.split('/').pop();
      } catch (e) {
        update.imageKey = '';
      }
    }
  }
  if (typeof next === 'function') {
    next();
  }
});

module.exports = mongoose.model('MenuItem', MenuItemSchema);
