const Order = require('../models/Order');
const { deductInventoryForOrder } = require('./inventoryController');
const Payment = require('../models/Payment');
const MenuItem = require('../models/MenuItem');
const razorpayService = require('../services/razorpayService');
const mongoose = require('mongoose');

/**
 * Creates a pending order in database and initiates a Razorpay Order
 * POST /api/payment/create-order
 */
const createOrder = async (req, res) => {
  try {
    const { cafeId, items, tableNumber, customerName, customerEmail, customerPhone, specialInstructions } = req.body;

    // Basic validation
    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart cannot be empty' });
    }
    if (!customerName || !customerPhone) {
      return res.status(400).json({ success: false, message: 'Customer name and phone are required' });
    }

    // Backend amount validation
    let calculatedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const itemId = item.id || item._id;
      let dbItem = null;

      // 1. Try finding by database ID if it's a valid Mongo ObjectId
      if (itemId && mongoose.Types.ObjectId.isValid(itemId)) {
        dbItem = await MenuItem.findById(itemId);
      }

      // 2. Fallback to name search if ID lookup fails (common for frontend mock IDs)
      if (!dbItem && item.name) {
        dbItem = await MenuItem.findOne({ name: new RegExp('^' + item.name + '$', 'i') });
      }

      // 3. If item doesn't exist, create it in DB to support seamless demo testing
      if (!dbItem) {
        dbItem = new MenuItem({
          name: item.name || 'Unknown Item',
          price: item.price || 0,
          category: 'Demo',
          description: `Delicious ${item.name || 'item'} for payment testing.`,
          available: true
        });
        await dbItem.save();
      }

      calculatedTotal += dbItem.price * item.quantity;
      validatedItems.push({
        id: dbItem._id.toString(),
        name: dbItem.name,
        price: dbItem.price,
        quantity: item.quantity
      });
    }

    // Create a new Order in DB with 'Pending' payment status
    const newOrder = new Order({
      cafeId: cafeId || 'CD001',
      tableNumber: tableNumber || 'Takeaway',
      items: validatedItems,
      totalAmount: calculatedTotal,
      customerName,
      customerEmail,
      customerPhone,
      specialInstructions: specialInstructions || '',
      paymentStatus: 'Pending',
      status: 'Placed'
    });

    const savedOrder = await newOrder.save();

    // Create order on Razorpay
    let razorpayOrder;
    try {
      razorpayOrder = await razorpayService.createRazorpayOrder(calculatedTotal);
    } catch (err) {
      // If Razorpay creation fails, mark order as Failed in DB and throw
      savedOrder.paymentStatus = 'Failed';
      await savedOrder.save();
      throw new Error(`Razorpay Order creation failed: ${err.message}`);
    }

    // Update the DB order with the Razorpay order ID
    savedOrder.razorpayOrderId = razorpayOrder.id;
    await savedOrder.save();

    return res.status(201).json({
      success: true,
      appOrderId: savedOrder._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // in paise
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder'
    });

  } catch (error) {
    console.error('Error in createOrder controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while preparing checkout order',
      error: error.message
    });
  }
};

/**
 * Verifies Razorpay payment signature, updates Order and creates Payment log
 * POST /api/payment/verify
 */
const verifyPayment = async (req, res) => {
  try {
    const { appOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!appOrderId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required validation payload parameters'
      });
    }

    // Cryptographically verify signature
    const isValid = razorpayService.verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);

    // Find our database order
    const order = await Order.findById(appOrderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pending order not found in database' });
    }

    if (!isValid) {
      order.paymentStatus = 'Failed';
      await order.save();
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Cryptographic signature signature mismatch.'
      });
    }

    // Complete Order state updates
    order.paymentStatus = 'Paid';
    order.status = 'Completed';
    order.razorpayPaymentId = razorpayPaymentId;
    const updatedOrder = await order.save();

    // Auto deduct inventory stock
    await deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items);

    // Create separate Payment record log for bookkeeping
    const paymentRecord = new Payment({
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      appOrderId: updatedOrder._id,
      amount: updatedOrder.totalAmount,
      status: 'success'
    });
    await paymentRecord.save();

    return res.status(200).json({
      success: true,
      message: 'Payment verified successfully and order finalized',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Error in verifyPayment controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during payment verification',
      error: error.message
    });
  }
};

/**
 * Initiates Razorpay payment for an existing order in database
 * POST /api/payment/pay-existing-order
 */
const payExistingOrder = async (req, res) => {
  try {
    const { appOrderId } = req.body;

    if (!appOrderId) {
      return res.status(400).json({ success: false, message: 'Order ID is required' });
    }

    const order = await Order.findById(appOrderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.paymentStatus === 'Paid') {
      return res.status(400).json({ success: false, message: 'Order is already paid' });
    }

    // Call Razorpay API to generate order
    let razorpayOrder;
    try {
      razorpayOrder = await razorpayService.createRazorpayOrder(order.totalAmount);
    } catch (err) {
      order.paymentStatus = 'Failed';
      await order.save();
      throw new Error(`Razorpay Order creation failed: ${err.message}`);
    }

    // Update Order with Razorpay Order ID
    order.razorpayOrderId = razorpayOrder.id;
    await order.save();

    return res.status(200).json({
      success: true,
      appOrderId: order._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount, // in paise
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder'
    });

  } catch (error) {
    console.error('Error in payExistingOrder controller:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while preparing checkout for existing order',
      error: error.message
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  payExistingOrder
};
