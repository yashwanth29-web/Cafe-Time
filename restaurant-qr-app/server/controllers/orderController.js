const Order = require('../models/Order');
const { deductInventoryForOrder } = require('./inventoryController');

// @desc    Create a new order
// @route   POST /api/orders
// @access  Public
const createOrder = async (req, res) => {
  try {
    const { cafeId, tableNumber, items, totalAmount, customerName, customerEmail, customerPhone } = req.body;

    // Simple validation
    if (!tableNumber) {
      return res.status(400).json({ success: false, message: 'Table number is required' });
    }
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must contain at least one item' });
    }
    if (totalAmount === undefined || totalAmount === null) {
      return res.status(400).json({ success: false, message: 'Total amount is required' });
    }

    const newOrder = new Order({
      cafeId: cafeId || 'CD001',
      tableNumber,
      items,
      totalAmount,
      status: 'Placed',
      customerName: customerName || '',
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || '',
      paymentStatus: 'Pending'
    });

    const savedOrder = await newOrder.save();
    
    // Auto deduct inventory stock
    await deductInventoryForOrder(savedOrder._id, savedOrder.cafeId, savedOrder.items);

    return res.status(201).json({ success: true, data: savedOrder });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ success: false, message: 'Server error while placing order', error: error.message });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Public (Owner Dashboard)
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching orders', error: error.message });
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Public (Customer Live Tracker)
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    return res.status(200).json({ success: true, data: order });
  } catch (error) {
    console.error('Error fetching single order:', error);
    return res.status(500).json({ success: false, message: 'Server error while retrieving order status', error: error.message });
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id
// @access  Public (Owner Dashboard)
const updateOrderStatus = async (req, res) => {
  try {
    const { status, paymentStatus } = req.body;
    const { id } = req.params;

    const updateFields = {};

    if (status !== undefined) {
      const allowedStatuses = ['Placed', 'Preparing', 'Ready', 'Delivered', 'Completed'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
      }
      updateFields.status = status;
    }

    if (paymentStatus !== undefined) {
      const allowedPaymentStatuses = ['Pending', 'Paid', 'Failed'];
      if (!allowedPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({ success: false, message: `Invalid paymentStatus. Must be one of: ${allowedPaymentStatuses.join(', ')}` });
      }
      updateFields.paymentStatus = paymentStatus;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided for update. Must be status or paymentStatus.' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateFields,
      { new: true, returnDocument: 'after', runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (updatedOrder.status === 'Completed' && !updatedOrder.inventoryDeducted) {
      await deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items);
    }

    return res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating order status', error: error.message });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus
};
