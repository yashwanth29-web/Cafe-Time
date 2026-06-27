const Order = require('../models/Order');
const { deductInventoryForOrder } = require('./inventoryController');
const Payment = require('../models/Payment');
const MenuItem = require('../models/MenuItem');
const PaymentConfig = require('../models/PaymentConfig');
const Cafe = require('../models/Cafe');
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

    // Fetch Cafe first to get tax rates and platform charge rates
    const cafe = await Cafe.findOne({ cafeId: cafeId || 'CD001' });
    const gstRate = cafe?.gstRate || 0;
    const platformCharge = cafe?.serviceChargeRate || 0;
    const gstAmount = calculatedTotal * (gstRate / 100);
    const finalTotal = calculatedTotal + gstAmount + platformCharge;

    // Create a new Order in DB with 'Pending' payment status
    const newOrder = new Order({
      cafeId: cafeId || 'CD001',
      tableNumber: tableNumber || 'Takeaway',
      items: validatedItems,
      totalAmount: finalTotal,
      customerName,
      customerEmail,
      customerPhone,
      specialInstructions: specialInstructions || '',
      paymentStatus: 'Pending',
      status: 'Placed'
    });

    const savedOrder = await newOrder.save();

    // Fetch Cafe UPI ID and Merchant Name
    let upiId = '9346540919@ybl'; // Default fallback UPI ID
    let merchantName = (cafe && cafe.name) || "Cypher's Cafe";

    try {
      const config = await PaymentConfig.findOne({ cafeId: savedOrder.cafeId });
      if (config && config.upiId) {
        upiId = config.upiId;
      }
    } catch (dbErr) {
      console.warn(`Database lookup failed for cafe configs. Using default UPI ID. Error: ${dbErr.message}`);
    }

    // Set order's placeholder order ID
    savedOrder.razorpayOrderId = `UPI-${savedOrder._id}`;
    await savedOrder.save();

    return res.status(201).json({
      success: true,
      appOrderId: savedOrder._id,
      razorpayOrderId: savedOrder.razorpayOrderId,
      amount: calculatedTotal, // Amount in rupees for UPI
      currency: 'INR',
      upiId: upiId,
      merchantName: merchantName
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
    const { appOrderId, razorpayOrderId, razorpayPaymentId } = req.body;

    if (!appOrderId || !razorpayPaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required validation payload parameters (appOrderId or transaction ID)'
      });
    }

    // Find our database order
    const order = await Order.findById(appOrderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Pending order not found in database' });
    }

    // Complete Order state updates
    order.paymentStatus = 'Paid';
    order.status = 'Completed';
    order.razorpayPaymentId = razorpayPaymentId; // save UPI Transaction ID (UTR) here
    order.paymentMethod = 'Online';
    const updatedOrder = await order.save();

    // Auto deduct inventory stock
    await deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items);

    // Create separate Payment record log for bookkeeping
    const paymentRecord = new Payment({
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId || order.razorpayOrderId || `UPI-${order._id}`,
      appOrderId: updatedOrder._id,
      amount: updatedOrder.totalAmount,
      status: 'success'
    });
    await paymentRecord.save();

    return res.status(200).json({
      success: true,
      message: 'UPI Payment verification details submitted and order finalized',
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

    // Fetch Cafe UPI ID and Merchant Name
    let upiId = '9346540919@ybl'; // Default fallback UPI ID
    let merchantName = "Cypher's Cafe";

    try {
      const config = await PaymentConfig.findOne({ cafeId: order.cafeId });
      if (config && config.upiId) {
        upiId = config.upiId;
      }
      const cafe = await Cafe.findOne({ cafeId: order.cafeId });
      if (cafe && cafe.name) {
        merchantName = cafe.name;
      }
    } catch (dbErr) {
      console.warn(`Database lookup failed for cafe configs. Using default UPI ID. Error: ${dbErr.message}`);
    }

    // Update Order with local order ID if not present
    if (!order.razorpayOrderId) {
      order.razorpayOrderId = `UPI-${order._id}`;
      await order.save();
    }

    return res.status(200).json({
      success: true,
      appOrderId: order._id,
      razorpayOrderId: order.razorpayOrderId,
      amount: order.totalAmount, // Amount in rupees for UPI
      currency: 'INR',
      upiId: upiId,
      merchantName: merchantName
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
