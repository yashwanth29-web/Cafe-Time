const Order = require('../models/Order');
const { deductInventoryForOrder } = require('./inventoryController');

// @desc    Create a new order
// @route   POST /api/orders
// @access  Public
const createOrder = async (req, res) => {
  try {
    const { cafeId, tableNumber, items, totalAmount, customerName, customerEmail, customerPhone, specialInstructions, source, staffId } = req.body;

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
      specialInstructions: specialInstructions || '',
      paymentStatus: 'Pending',
      source: source || 'QR',
      staffId: staffId || null
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
    const { status, paymentStatus, paymentMethod } = req.body;
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

    if (paymentMethod !== undefined) {
      const allowedPaymentMethods = ['Online', 'Counter', 'Pending'];
      if (!allowedPaymentMethods.includes(paymentMethod)) {
        return res.status(400).json({ success: false, message: `Invalid paymentMethod. Must be one of: ${allowedPaymentMethods.join(', ')}` });
      }
      updateFields.paymentMethod = paymentMethod;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields provided for update. Must be status, paymentStatus, or paymentMethod.' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      updateFields,
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (['Ready', 'Completed', 'Delivered'].includes(updatedOrder.status) && !updatedOrder.inventoryDeducted) {
      await deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items);
      // Fetch latest document status
      const latestOrder = await Order.findById(id);
      return res.status(200).json({ success: true, data: latestOrder || updatedOrder });
    }

    return res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating order status', error: error.message });
  }
};

// @desc    Update order payment method (Public for customers)
// @route   PATCH /api/orders/:id/payment-method
// @access  Public
const updateOrderPaymentMethod = async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const { id } = req.params;

    const allowedPaymentMethods = ['Online', 'Counter', 'Pending'];
    if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: `Invalid paymentMethod. Must be one of: ${allowedPaymentMethods.join(', ')}` });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { paymentMethod },
      { returnDocument: 'after', runValidators: true }
    );

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    return res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    console.error('Error updating order payment method:', error);
    return res.status(500).json({ success: false, message: 'Server error while updating payment method', error: error.message });
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderPaymentMethod
};
