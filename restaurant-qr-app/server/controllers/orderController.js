const Order = require('../models/Order');
const Branch = require('../models/Branch');
const mongoose = require('mongoose');
const { deductInventoryForOrder } = require('./inventoryController');

const emitOrderUpdated = async (order) => {
  if (!order) return;
  try {
    const { getIO } = require('../config/socket');
    const io = getIO();
    const mongoose = require('mongoose');
    const Branch = require('../models/Branch');
    
    let branchStr = String(order.branchId || '');
    if (mongoose.isValidObjectId(branchStr)) {
      const branchDoc = await Branch.findById(branchStr).lean();
      if (branchDoc) {
        branchStr = branchDoc.branchId;
      }
    }
    const orderIdStr = String(order._id || '');
    
    if (branchStr) {
      io.to(`branch:${branchStr}`).emit('orderUpdated', order);
    }
    io.to(`cafe:${order.cafeId}:owner`).emit('orderUpdated', order);
    io.to(`order:${orderIdStr}`).emit('orderUpdated', order);
    
    if (order.paymentStatus === 'Paid') {
      if (branchStr) {
        io.to(`branch:${branchStr}`).emit('paymentCompleted', order);
      }
      io.to(`cafe:${order.cafeId}:owner`).emit('paymentCompleted', order);
      io.to(`order:${orderIdStr}`).emit('paymentCompleted', order);
    }
    
    console.log(`[SOCKET] Broadcasted update events for order ${orderIdStr} to branch:${branchStr}`);
  } catch (err) {
    console.error('[SOCKET] Error emitting order updates:', err.message);
  }
};

// A helper to append fallback values to legacy orders
const appendLegacyFallback = async (order, branchMap = null) => {
  if (!order) return order;
  const orderObj = order.toObject ? order.toObject() : order;

  // Resolve the branch code string if it's an ObjectId in the DB
  if (orderObj.branchId && mongoose.isValidObjectId(orderObj.branchId)) {
    let branchDoc;
    const branchIdStr = String(orderObj.branchId);
    if (branchMap && branchMap.has(branchIdStr)) {
      branchDoc = branchMap.get(branchIdStr);
    } else {
      branchDoc = await Branch.findById(orderObj.branchId).lean();
      if (branchMap && branchDoc) branchMap.set(branchIdStr, branchDoc);
    }
    if (branchDoc) {
      orderObj.branchObjectId = branchIdStr;
      orderObj.branchId = branchDoc.branchId; // e.g. "BR002"
    }
  }

  if (!orderObj.branchId || !orderObj.branchName) {
    // Legacy fallback
    // Find the default branch or first branch of the cafe
    let defaultBranch;
    const targetCafeId = orderObj.cafeId || 'CD001';
    if (branchMap && branchMap.has(targetCafeId)) {
      defaultBranch = branchMap.get(targetCafeId);
    } else {
      defaultBranch = await Branch.findOne({ cafeId: targetCafeId }).lean() || {
        _id: null,
        branchName: 'DR . Chai Cafe',
        address: 'Comrade Puchalapalli Sundarayya Road, Yerrapalem'
      };
      if (branchMap) branchMap.set(targetCafeId, defaultBranch);
    }
    orderObj.branchId = orderObj.branchId || defaultBranch._id;
    orderObj.branchName = orderObj.branchName || defaultBranch.branchName;
    orderObj.branchAddress = orderObj.branchAddress || defaultBranch.address;
  }

  if (!orderObj.grandTotal) {
    orderObj.grandTotal = orderObj.totalAmount || 0;
    orderObj.subtotal = Number((orderObj.grandTotal / 1.05).toFixed(2));
    orderObj.tax = Number((orderObj.grandTotal - orderObj.subtotal).toFixed(2));
  }
  
  return orderObj;
};

// @desc    Create a new order
// @route   POST /api/orders
// @access  Public
const createOrder = async (req, res) => {
  try {
    const { cafeId, tableNumber, items, totalAmount, customerName, customerEmail, customerPhone, specialInstructions, branchId } = req.body;

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

    // Branch validation
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Branch information missing' });
    }

    // Find the branch
    const resolvedBranch = await Branch.findOne({
      $or: [
        { branchId: branchId },
        { _id: mongoose.isValidObjectId(branchId) ? branchId : undefined }
      ],
      cafeId: cafeId || 'CD001'
    }).lean();

    if (!resolvedBranch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    const finalSubtotal = req.body.subtotal !== undefined ? req.body.subtotal : totalAmount;
    const finalTax = req.body.tax !== undefined ? req.body.tax : 0;
    const finalGrandTotal = req.body.grandTotal !== undefined ? req.body.grandTotal : totalAmount;

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
      paymentStatus: req.body.paymentStatus || 'Pending',
      paymentMethod: req.body.paymentMethod || 'Pending',
      orderSource: req.body.orderSource || 'QR',
      createdBy: req.body.createdBy || '',
      createdByRole: req.body.createdByRole || '',
      branchId: resolvedBranch._id,
      branchName: resolvedBranch.branchName,
      branchAddress: resolvedBranch.address,
      subtotal: finalSubtotal,
      tax: finalTax,
      grandTotal: finalGrandTotal
    });

    const savedOrder = await newOrder.save();
    
    // Auto deduct inventory stock
    await deductInventoryForOrder(savedOrder._id, savedOrder.cafeId, savedOrder.items);

    const formattedOrder = await appendLegacyFallback(savedOrder);

    // Emit orderCreated
    try {
      const { getIO } = require('../config/socket');
      const io = getIO();
      const branchIdStr = String(formattedOrder.branchId || '');
      if (branchIdStr) {
        io.to(`branch:${branchIdStr}`).emit('orderCreated', formattedOrder);
      }
      io.to(`cafe:${formattedOrder.cafeId}:owner`).emit('orderCreated', formattedOrder);
      console.log(`[SOCKET] Broadcasted orderCreated for ${formattedOrder._id}`);
    } catch (err) {
      console.error('[SOCKET] Error emitting orderCreated:', err.message);
    }

    return res.status(201).json({ success: true, data: formattedOrder });
  } catch (error) {
    console.error('Error creating order:', error);
    return res.status(500).json({ success: false, message: 'Server error while placing order', error: error.message });
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Public (Owner/Staff Dashboards)
const getOrders = async (req, res) => {
  try {
    // Optional filters and pagination
    const { cafeId, branchId, status, page, limit } = req.query;
    
    const query = {};
    if (cafeId) query.cafeId = cafeId;
    if (branchId) {
      if (mongoose.isValidObjectId(branchId)) {
        query.branchId = branchId;
      } else {
        // Resolve code BR002 to ObjectId
        const resolvedBranch = await Branch.findOne({ branchId, cafeId: cafeId || 'CD001' }).lean();
        if (resolvedBranch) {
          query.branchId = resolvedBranch._id;
        } else {
          query.branchId = branchId;
        }
      }
    }
    if (status) query.status = status;

    let ordersQuery = Order.find(query).sort({ createdAt: -1 });

    if (page && limit) {
      const skipVal = (parseInt(page) - 1) * parseInt(limit);
      const limitVal = parseInt(limit);
      ordersQuery = ordersQuery.skip(skipVal).limit(limitVal);
    }

    const orders = await ordersQuery.lean();

    // Cache branches in memory to avoid N+1 query loop
    const branchMap = new Map();
    const allBranches = await Branch.find().lean();
    allBranches.forEach(b => {
      branchMap.set(String(b._id), b);
      branchMap.set(String(b.branchId), b);
      if (!branchMap.has(b.cafeId)) {
        branchMap.set(b.cafeId, b);
      }
    });

    const formattedOrders = [];
    for (const order of orders) {
      formattedOrders.push(await appendLegacyFallback(order, branchMap));
    }

    return res.status(200).json({ 
      success: true, 
      count: formattedOrders.length, 
      data: formattedOrders 
    });
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
    const order = await Order.findById(id).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const formattedOrder = await appendLegacyFallback(order);
    return res.status(200).json({ success: true, data: formattedOrder });
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
      const allowedPaymentMethods = ['Online', 'Counter', 'Pending', 'Cash', 'UPI', 'Card'];
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
      { new: true, returnDocument: 'after', runValidators: true }
    ).lean();

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (['Ready', 'Completed', 'Delivered'].includes(updatedOrder.status) && !updatedOrder.inventoryDeducted) {
      await deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items);
      const latestOrder = await Order.findById(id).lean();
      const formattedLatest = await appendLegacyFallback(latestOrder || updatedOrder);
      await emitOrderUpdated(formattedLatest);
      return res.status(200).json({ success: true, data: formattedLatest });
    }

    const formattedOrder = await appendLegacyFallback(updatedOrder);
    await emitOrderUpdated(formattedOrder);
    return res.status(200).json({ success: true, data: formattedOrder });
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

    const allowedPaymentMethods = ['Online', 'Counter', 'Pending', 'Cash', 'UPI', 'Card'];
    if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: `Invalid paymentMethod. Must be one of: ${allowedPaymentMethods.join(', ')}` });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      { paymentMethod },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const formattedOrder = await appendLegacyFallback(updatedOrder);
    await emitOrderUpdated(formattedOrder);
    return res.status(200).json({ success: true, data: formattedOrder });
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
