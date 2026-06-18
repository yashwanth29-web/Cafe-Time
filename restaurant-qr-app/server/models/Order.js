const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true
  }
});

const OrderSchema = new mongoose.Schema({
  cafeId: {
    type: String,
    required: true,
    default: 'CD001'
  },
  tableNumber: {
    type: String,
    required: true
  },
  items: {
    type: [OrderItemSchema],
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['Placed', 'Preparing', 'Ready', 'Delivered', 'Completed'],
    default: 'Placed'
  },
  customerName: {
    type: String,
    default: ''
  },
  customerEmail: {
    type: String,
    default: ''
  },
  customerPhone: {
    type: String,
    default: ''
  },
  razorpayOrderId: {
    type: String,
    default: ''
  },
  razorpayPaymentId: {
    type: String,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    enum: ['Online', 'Counter', 'Pending'],
    default: 'Pending'
  },
  inventoryDeducted: {
    type: Boolean,
    default: false
  },
  specialInstructions: {
    type: String,
    default: ''
  },
  source: {
    type: String,
    enum: ['QR', 'STAFF'],
    default: 'QR'
  },
  staffId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for scalability and query optimization
OrderSchema.index({ cafeId: 1, createdAt: -1 });
OrderSchema.index({ cafeId: 1, status: 1 });
OrderSchema.index({ cafeId: 1, tableNumber: 1, status: 1 });

module.exports = mongoose.model('Order', OrderSchema);
