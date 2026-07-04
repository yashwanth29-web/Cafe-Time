const mongoose = require('mongoose');

const MenuOverrideSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    default: 'CD001'
  },
  branchId: {
    type: String,
    required: true
  },
  menuItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MenuItem',
    required: true
  },
  price: {
    type: Number,
    // If not set, it defaults to the Master Menu price
  },
  available: {
    type: Boolean,
    // If not set, it inherits the Master Menu availability
  },
  isHidden: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

MenuOverrideSchema.index({ cafeId: 1, branchId: 1, menuItemId: 1 }, { unique: true });

module.exports = mongoose.model('MenuOverride', MenuOverrideSchema);
