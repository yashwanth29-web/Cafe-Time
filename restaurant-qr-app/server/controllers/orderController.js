const Order = require('../models/Order');
const Branch = require('../models/Branch');
const mongoose = require('mongoose');
const { deductInventoryForOrder, updateMenuItemAvailabilityFromInventory } = require('./inventoryController');
const socket = require('../socket');

// Active branches in-memory cache with 60s TTL
const branchCache = new Map();
const CACHE_TTL = 60000; // 60 seconds

const getCachedBranch = async (cacheKey, queryFn) => {
  const now = Date.now();
  if (branchCache.has(cacheKey)) {
    const entry = branchCache.get(cacheKey);
    if (now - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
  }
  const result = await queryFn();
  branchCache.set(cacheKey, { data: result, timestamp: now });
  return result;
};

// helper to emit order updates over Socket.io
const emitOrderUpdated = async (order, branchMap = null) => {
  if (!order) return;
  try {
    const { getIO } = require('../config/socket');
    const io = getIO();
    if (!io) {
      console.warn('[SOCKET] io not initialized, skipping real-time emit');
      return;
    }

    let branchStr = String(order.branchId || '');
    if (mongoose.isValidObjectId(branchStr)) {
      let branchDoc;
      if (branchMap && branchMap.has(branchStr)) {
        branchDoc = branchMap.get(branchStr);
      } else {
        branchDoc = await getCachedBranch(`id:${branchStr}`, () => Branch.findById(branchStr).lean());
        if (branchMap && branchDoc) branchMap.set(branchStr, branchDoc);
      }
      if (branchDoc) {
        branchStr = branchDoc.branchId;
      }
    }
    const orderIdStr = String(order._id || '');
    const cafeId = order.cafeId || 'CD001';

    // Broadcast standard events (camelCase) to standard room names
    if (branchStr) {
      io.to(`branch:${branchStr}`).emit('orderCreated', order);
      io.to(`branch:${branchStr}`).emit('orderUpdated', order);
    }
    io.to(`cafe:${cafeId}:owner`).emit('orderCreated', order);
    io.to(`cafe:${cafeId}:owner`).emit('orderUpdated', order);
    io.to(`order:${orderIdStr}`).emit('orderUpdated', order);

    // Broadcast compatibility events (snake_case) to compatibility room names
    if (branchStr) {
      io.to(`branch_${cafeId}_${branchStr}`).emit('order_created', order);
      io.to(`branch_${cafeId}_${branchStr}`).emit('order_updated', order);
    }
    io.to(`cafe_${cafeId}`).emit('order_created', order);
    io.to(`cafe_${cafeId}`).emit('order_updated', order);
    io.to(`cafe_${cafeId}_owner`).emit('order_created', order);
    io.to(`cafe_${cafeId}_owner`).emit('order_updated', order);
    io.to(`order_${orderIdStr}`).emit('order_updated', order);

    // If order payment is paid, broadcast payment events
    if (order.paymentStatus === 'Paid') {
      if (branchStr) {
        io.to(`branch:${branchStr}`).emit('paymentCompleted', order);
        io.to(`branch_${cafeId}_${branchStr}`).emit('payment_completed', order);
      }
      io.to(`cafe:${cafeId}:owner`).emit('paymentCompleted', order);
      io.to(`cafe_${cafeId}_owner`).emit('payment_completed', order);
      io.to(`order:${orderIdStr}`).emit('paymentCompleted', order);
      io.to(`order_${orderIdStr}`).emit('payment_completed', order);
    }
    console.log(`[SOCKET] Broadcasted updates for order ${orderIdStr}`);
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
      branchDoc = await getCachedBranch(`id:${branchIdStr}`, () => Branch.findById(orderObj.branchId).lean());
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
      defaultBranch = await getCachedBranch(`cafe:${targetCafeId}`, () => Branch.findOne({ cafeId: targetCafeId }).lean()) || {
        _id: null,
        branchName: 'DR . Chai Cafe',
        address: 'Comrade Puchalapalli Sundarayya Road, Yerrapalem'
      };
      if (branchMap) branchMap.set(targetCafeId, defaultBranch);
    }
    orderObj.branchId = orderObj.branchId || defaultBranch.branchId || 'default';
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
    const { 
      cafeId, 
      branchId, 
      tableNumber, 
      items, 
      totalAmount, 
      customerName, 
      customerEmail, 
      customerPhone, 
      specialInstructions, 
      source, 
      staffId, 
      paymentStatus, 
      paymentMethod, 
      orderSource, 
      createdBy, 
      createdByRole,
      subtotal,
      tax,
      grandTotal
    } = req.body;

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
    if (!branchId) {
      return res.status(400).json({ success: false, message: 'Branch information missing' });
    }

    const activeCafeId = cafeId || 'CD001';

    // Find the branch
    const resolvedBranch = await Branch.findOne({
      $or: [
        { branchId: branchId },
        { _id: mongoose.isValidObjectId(branchId) ? branchId : undefined }
      ],
      cafeId: activeCafeId
    }).lean();

    if (!resolvedBranch) {
      return res.status(404).json({ success: false, message: 'Branch not found' });
    }

    const finalSubtotal = subtotal !== undefined ? subtotal : Number((totalAmount / 1.05).toFixed(2));
    const finalTax = tax !== undefined ? tax : Number((totalAmount - finalSubtotal).toFixed(2));
    const finalGrandTotal = grandTotal !== undefined ? grandTotal : totalAmount;

    // Build the order document
    const newOrder = new Order({
      cafeId: activeCafeId,
      branchId: resolvedBranch ? String(resolvedBranch._id) : (branchId || 'default'),
      branchName: resolvedBranch ? resolvedBranch.branchName : 'Main Branch',
      branchAddress: resolvedBranch ? resolvedBranch.address : '',
      tableNumber,
      items,
      totalAmount,
      status: 'Placed',
      customerName: customerName || '',
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || '',
      specialInstructions: specialInstructions || '',
      paymentStatus: paymentStatus || 'Pending',
      paymentMethod: paymentMethod || 'Pending',
      orderSource: orderSource || source || 'QR',
      createdBy: createdBy || '',
      createdByRole: createdByRole || '',
      subtotal: finalSubtotal,
      tax: finalTax,
      grandTotal: finalGrandTotal,
      source: source || orderSource || 'QR',
      staffId: staffId || null
    });

    const savedOrder = await newOrder.save();
    
    // Auto deduct inventory stock (run asynchronously in background to not block response)
    const activeBId = resolvedBranch ? resolvedBranch.branchId : 'default';
    deductInventoryForOrder(savedOrder._id, savedOrder.cafeId, savedOrder.items)
      .then(() => updateMenuItemAvailabilityFromInventory(activeCafeId, null, activeBId))
      .catch(invErr => console.warn('Background inventory deduction warning during order creation:', invErr.message));

    const formattedOrder = await appendLegacyFallback(savedOrder);

    // Broadcast the new order over socket
    await emitOrderUpdated(formattedOrder);

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
    const filterQuery = {};
    const cafeId = req.query.cafeId || (req.user && req.user.cafeId) || 'CD001';
    if (cafeId) filterQuery.cafeId = cafeId;

    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user?.role || '').toLowerCase());
    const queryBranch = req.query.branchId || req.headers['x-branch-id'];
    
    if (isStaff && req.user?.assignedBranch) {
      filterQuery.branchId = req.user.assignedBranch;
    } else if (queryBranch) {
      // If owner/admin filters by a branch
      filterQuery.branchId = queryBranch;
    } // If owner requests all branches (no queryBranch), don't restrict branchId!

    if (req.query.active === 'true') {
      filterQuery.status = { $ne: 'Completed' };
    }
    if (req.query.status) {
      filterQuery.status = req.query.status;
    }

    if (req.query.date) {
      const parts = req.query.date.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const startOfDay = new Date(Date.UTC(year, month, day) - (5.5 * 60 * 60 * 1000));
        const endOfDay = new Date(Date.UTC(year, month, day + 1) - (5.5 * 60 * 60 * 1000));
        filterQuery.createdAt = { $gte: startOfDay, $lt: endOfDay };
      }
    }

    const orders = await Order.find(filterQuery).sort({ createdAt: -1 }).limit(200).lean();
    const branchMap = new Map();
    const allBranches = await Branch.find({ cafeId }).lean();
    allBranches.forEach(b => {
      branchMap.set(String(b._id), b);
      branchMap.set(String(b.branchId), b);
    });

    const formattedOrders = [];
    for (const order of orders) {
      formattedOrders.push(await appendLegacyFallback(order, branchMap));
    }

    return res.status(200).json({ success: true, count: formattedOrders.length, data: formattedOrders });
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
    const cafeId = req.query.cafeId || req.cafeId || 'CD001';
    
    let order = await Order.findOne({ _id: id, cafeId }).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found under this cafe context' });
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

    const userRole = (req.user?.role || '').toLowerCase();
    const isOwnerOrAdmin = ['owner', 'admin', 'super_admin'].includes(userRole);

    // 1. Strict Branch/Cafe Isolation Query
    const query = { _id: id, cafeId: req.cafeId || 'CD001' };
    if (!isOwnerOrAdmin) {
      query.branchId = req.branchId || 'default';
    }

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found in this branch context' });
    }

    // 2. Load Branch config for Unified Staff Mode check
    const activeBranchId = order.branchId || req.branchId || 'default';
    const branch = await getCachedBranch(`mode:${activeBranchId}:${req.cafeId || 'CD001'}`, () => Branch.findOne({ 
      $or: [
        { branchId: activeBranchId },
        { _id: mongoose.isValidObjectId(activeBranchId) ? activeBranchId : undefined }
      ],
      cafeId: req.cafeId || 'CD001'
    }).lean());
    
    const isUnified = branch ? !!branch.unifiedStaffMode : false;

    // Check role permissions if Unified Staff Mode is disabled
    if (!isUnified && !isOwnerOrAdmin && !['manager'].includes(userRole)) {
      if (status === 'Preparing' || status === 'Ready') {
        if (userRole !== 'chef') {
          return res.status(403).json({ success: false, message: 'Access Denied: Only Kitchen staff (Chefs) can prepare orders or mark them as ready.' });
        }
      } else if (status === 'Delivered' || status === 'Completed') {
        if (userRole !== 'waiter' && userRole !== 'cashier') {
          return res.status(403).json({ success: false, message: 'Access Denied: Only Waiters or Cashiers can serve orders or collect payment.' });
        }
      }
    }

    const updateFields = {};

    if (status !== undefined) {
      const allowedStatuses = ['Placed', 'Preparing', 'Ready', 'Delivered', 'Completed'];
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
      }
      updateFields.status = status;

      // Permanent Audit Trail updates
      if (status === 'Preparing') {
        updateFields.preparingBy = req.user._id;
        updateFields.preparingByName = req.user.name;
        updateFields.preparingAt = new Date();
      } else if (status === 'Ready') {
        updateFields.readyBy = req.user._id;
        updateFields.readyByName = req.user.name;
        updateFields.readyAt = new Date();
      } else if (status === 'Delivered') {
        updateFields.servedBy = req.user._id;
        updateFields.servedByName = req.user.name;
        updateFields.servedAt = new Date();
      } else if (status === 'Completed') {
        updateFields.paidBy = req.user._id;
        updateFields.paidByName = req.user.name;
        updateFields.paidAt = new Date();
        updateFields.paymentStatus = 'Paid';
        if (paymentMethod) {
          updateFields.paymentMethod = paymentMethod;
        } else if (order.paymentMethod === 'Pending' || !order.paymentMethod) {
          updateFields.paymentMethod = 'Cash'; // Default fallback
        }
      }
    }

    if (paymentStatus !== undefined) {
      const allowedPaymentStatuses = ['Pending', 'Paid', 'Failed'];
      if (!allowedPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({ success: false, message: `Invalid paymentStatus. Must be one of: ${allowedPaymentStatuses.join(', ')}` });
      }
      updateFields.paymentStatus = paymentStatus;
      if (paymentStatus === 'Paid') {
        updateFields.paidAt = new Date();
        if (paymentMethod) {
          updateFields.paymentMethod = paymentMethod;
        }
      }
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

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id },
      { $set: updateFields },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order update failed or order not found' });
    }

    // Auto deduct inventory (run asynchronously in background to not block response)
    if (['Ready', 'Completed', 'Delivered'].includes(updatedOrder.status) && !updatedOrder.inventoryDeducted) {
      const activeBId = branch ? branch.branchId : 'default';
      deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items)
        .then(() => updateMenuItemAvailabilityFromInventory(updatedOrder.cafeId, null, activeBId))
        .catch(err => console.warn('Background inventory deduction warning during status update:', err.message));
    }

    const branchMap = new Map();
    if (branch) {
      if (branch._id) branchMap.set(String(branch._id), branch);
      if (branch.branchId) branchMap.set(String(branch.branchId), branch);
    }

    const formattedOrder = await appendLegacyFallback(updatedOrder, branchMap);

    // Broadcast update events over sockets
    await emitOrderUpdated(formattedOrder, branchMap);

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
      { paymentMethod, paymentStatus: 'Paid', paidAt: new Date() },
      { returnDocument: 'after', runValidators: true }
    ).lean();

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Deduct inventory (run asynchronously in background to not block response)
    const Branch = require('../models/Branch');
    Branch.findById(updatedOrder.branchId).lean()
      .then(branchDoc => {
        const bId = branchDoc ? branchDoc.branchId : 'default';
        return deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items)
          .then(() => updateMenuItemAvailabilityFromInventory(updatedOrder.cafeId, null, bId));
      })
      .catch(err => console.warn('Background inventory deduction warning during payment update:', err.message));

    const formattedOrder = await appendLegacyFallback(updatedOrder);

    // Broadcast socket updates
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
