const Order = require('../models/Order');
const Branch = require('../models/Branch');
const Cafe = require('../models/Cafe');
const OperationalConfig = require('../models/OperationalConfig');
const PaymentConfig = require('../models/PaymentConfig');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const mongoose = require('mongoose');
const { deductInventoryForOrder, updateMenuItemAvailabilityFromInventory } = require('./inventoryController');

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
    const cafeId = order.cafeId;

    // Broadcast standard events (camelCase) to standard room names (strictly isolated with cafeId)
    if (branchStr) {
      io.to(`cafe:${cafeId}:branch:${branchStr}`).emit('orderCreated', order);
      io.to(`cafe:${cafeId}:branch:${branchStr}`).emit('orderUpdated', order);
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
        io.to(`cafe:${cafeId}:branch:${branchStr}`).emit('paymentCompleted', order);
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
    const targetCafeId = orderObj.cafeId;
    if (branchMap && branchMap.has(targetCafeId)) {
      defaultBranch = branchMap.get(targetCafeId);
    } else {
      defaultBranch = await getCachedBranch(`cafe:${targetCafeId}`, () => Branch.findOne({ cafeId: targetCafeId }).lean()) || {
        _id: null,
        branchName: 'Primary Location',
        address: ''
      };
      if (branchMap) branchMap.set(targetCafeId, defaultBranch);
    }
    orderObj.branchId = orderObj.branchId || defaultBranch.branchId || 'default';
    orderObj.branchName = orderObj.branchName || defaultBranch.branchName;
    orderObj.branchAddress = orderObj.branchAddress || defaultBranch.address;
  }

  if (!orderObj.cafeName || !orderObj.cafeLogo || !orderObj.cafeGstNumber) {
    const targetCafeId = orderObj.cafeId;
    const defaultCafe = await getCachedBranch(`cafeInfo:${targetCafeId}`, () => Cafe.findOne({ cafeId: targetCafeId }).lean());
    if (defaultCafe) {
      orderObj.cafeName = orderObj.cafeName || defaultCafe.name || 'Our Cafe';
      orderObj.cafeLogo = orderObj.cafeLogo || defaultCafe.logoUrl || '';
      orderObj.cafeGstNumber = orderObj.cafeGstNumber || defaultCafe.gstNumber || '';
      orderObj.cafeSupportNumber = orderObj.cafeSupportNumber || defaultCafe.supportNumber || '';
    } else {
      orderObj.cafeName = orderObj.cafeName || 'Our Cafe';
      orderObj.cafeLogo = orderObj.cafeLogo || '';
      orderObj.cafeGstNumber = orderObj.cafeGstNumber || '';
      orderObj.cafeSupportNumber = orderObj.cafeSupportNumber || '';
    }
  }

  if (!orderObj.invoiceId || !orderObj.receiptId || !orderObj.kotId || !orderObj.potId) {
    const hexId = String(orderObj._id).slice(-6).toUpperCase();
    orderObj.invoiceId = orderObj.invoiceId || 'INV-' + hexId;
    orderObj.receiptId = orderObj.receiptId || 'REC-' + hexId;
    orderObj.kotId = orderObj.kotId || 'KOT-' + hexId;
    orderObj.potId = orderObj.potId || 'POT-' + hexId;
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
const createOrder = async (req, res, next) => {
  let session = null;
  let useTransaction = false;

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
      grandTotal,
      razorpayPaymentId
    } = req.body;

    const targetCafeId = cafeId;
    if (!targetCafeId) {
      return res.status(400).json({ success: false, message: 'Missing cafeId' });
    }
    const Cafe = require('../models/Cafe');
    const targetCafe = await Cafe.findOne({ cafeId: targetCafeId });
    if (targetCafe && targetCafe.isDeleted) {
      return res.status(403).json({ success: false, message: 'This cafe has been deleted. Order placement is disabled.' });
    }

    // 1. Simple validation
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

    const activeCafeId = cafeId;
    if (!activeCafeId) {
      return res.status(400).json({ success: false, message: 'Missing cafeId' });
    }

    // 2. Cafe Validation
    const resolvedCafe = await Cafe.findOne({ cafeId: activeCafeId }).lean();
    if (!resolvedCafe) {
      return res.status(400).json({ success: false, message: 'Cafe not found' });
    }
    if (resolvedCafe.isActive === false) {
      return res.status(403).json({ success: false, message: 'This cafe is currently inactive' });
    }
    if (resolvedCafe.subscriptionStatus !== 'Active') {
      return res.status(403).json({ success: false, message: 'This cafe subscription is suspended or expired' });
    }

    // 3. Branch Validation
    const resolvedBranch = await Branch.findOne({
      $or: [
        { branchId: branchId },
        { _id: mongoose.isValidObjectId(branchId) ? branchId : undefined }
      ],
      cafeId: activeCafeId
    }).lean();

    if (!resolvedBranch) {
      return res.status(400).json({ success: false, message: 'Branch not found' });
    }
    if (resolvedBranch.isActive === false) {
      return res.status(403).json({ success: false, message: 'This branch is currently inactive' });
    }

    // 4. Table Validation
    const activeTableNumber = String(tableNumber).trim();
    if (activeTableNumber !== 'Takeaway' && activeTableNumber !== 'Walk-in') {
      // Validate table by performing a query including cafeId, branchId, and tableNumber
      const opConfig = await OperationalConfig.findOne({
        cafeId: activeCafeId,
        branchId: resolvedBranch.branchId,
        tables: {
          $elemMatch: {
            $or: [
              { id: { $regex: new RegExp('^' + activeTableNumber + '$', 'i') } },
              { label: { $regex: new RegExp('^' + activeTableNumber + '$', 'i') } },
              { id: { $regex: new RegExp('^t' + activeTableNumber + '$', 'i') } },
              { label: { $regex: new RegExp('^table[- ]?' + activeTableNumber + '$', 'i') } }
            ]
          }
        }
      }).lean();

      if (!opConfig) {
        return res.status(400).json({ success: false, message: `Table ${activeTableNumber} does not exist in this branch` });
      }
    }

    // 5. Customer Validation (mandatory for QR orders)
    const isQR = (source === 'QR' || orderSource === 'QR' || (!source && !orderSource));
    if (isQR) {
      if (!customerName || !customerName.trim()) {
        return res.status(400).json({ success: false, message: 'Customer name is required' });
      }
      if (!customerPhone || !customerPhone.trim()) {
        return res.status(400).json({ success: false, message: 'Customer phone number is required' });
      }
    }

    // Strict 10-digit numeric phone number validation
    if (customerPhone) {
      const cleanPhone = String(customerPhone).trim();
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid 10-digit mobile number.'
        });
      }
    }

    // 6. Menu and Cart Item Validation
    let computedTotal = 0;
    const validatedItems = [];

    for (const item of items) {
      const itemId = item.id || item._id;
      if (!mongoose.isValidObjectId(itemId)) {
        return res.status(400).json({ success: false, message: `Invalid item ID: ${itemId}` });
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        return res.status(400).json({ success: false, message: `Invalid quantity for item ${item.name || 'Unnamed'}` });
      }

      // Find the menu item bypassing branch filter
      let dbItem = await MenuItem.findOne({ _id: itemId, cafeId: activeCafeId }, null, { bypassBranchFilter: true }).lean();

      if (!dbItem) {
        return res.status(400).json({ success: false, message: `Menu item "${item.name || itemId}" not found` });
      }

      if (dbItem.available === false || dbItem.isHidden === true) {
        return res.status(400).json({ success: false, message: `Menu item "${dbItem.name}" is currently out of stock or unavailable` });
      }

      const itemPrice = dbItem.price;
      const itemQty = Number(item.quantity);
      computedTotal += itemPrice * itemQty;

      validatedItems.push({
        id: String(dbItem._id),
        name: dbItem.name,
        price: itemPrice,
        quantity: itemQty,
        image: dbItem.image || dbItem.imageUrl || '/images/default-food.png'
      });
    }

    // 7. Payment Config tax and platformCharge
    const paymentConfig = await PaymentConfig.findOne({ cafeId: activeCafeId, branchId: resolvedBranch.branchId }).lean();
    const taxRate = paymentConfig ? (paymentConfig.taxRate || 0) : 5; // Default 5%
    const platformCharge = paymentConfig ? (paymentConfig.platformCharge || 0) : 0;

    const finalSubtotal = computedTotal;
    const finalTax = Number((finalSubtotal * (taxRate / 100)).toFixed(2));
    const finalGrandTotal = Number((finalSubtotal + finalTax + platformCharge).toFixed(2));

    // Resolve ownerId
    let resolvedOwnerId = null;
    if (resolvedCafe) {
      if (resolvedCafe.ownerId) {
        resolvedOwnerId = resolvedCafe.ownerId;
      } else if (resolvedCafe.ownerEmail) {
        const ownerUser = await User.findOne({ email: resolvedCafe.ownerEmail, role: { $in: ['admin', 'owner', 'ADMIN', 'OWNER'] } }).lean();
        if (ownerUser) {
          resolvedOwnerId = ownerUser._id;
        }
      }
    }

    // 8. Unique ID and Sequence Generation
    const newOrderId = new mongoose.Types.ObjectId();
    const uniqueId = String(newOrderId).slice(-8).toUpperCase();

    // 9. Transaction session instantiation
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch (sessionErr) {
      session = null;
      useTransaction = false;
    }

    // Normalize source and orderSource to keep them perfectly synchronized
    let normalizedSource = 'QR';
    let normalizedOrderSource = 'QR';
    const staffSourceValues = ['STAFF', 'MANUAL', 'TAKEAWAY', 'WALK_IN', 'DINE_IN'];
    if (staffSourceValues.includes(String(source).toUpperCase()) || staffSourceValues.includes(String(orderSource).toUpperCase())) {
      normalizedSource = 'STAFF';
      normalizedOrderSource = orderSource ? String(orderSource).toUpperCase() : 'STAFF';
      if (!['QR', 'MANUAL', 'TAKEAWAY', 'WALK_IN', 'DINE_IN', 'STAFF'].includes(normalizedOrderSource)) {
        normalizedOrderSource = 'STAFF';
      }
    }

    // Build the order document
    const newOrder = new Order({
      _id: newOrderId,
      cafeId: activeCafeId,
      branchId: resolvedBranch ? resolvedBranch.branchId : (branchId || 'default'),
      branchObjectId: resolvedBranch ? resolvedBranch._id : null,
      branchName: resolvedBranch ? resolvedBranch.branchName : '',
      branchAddress: resolvedBranch ? resolvedBranch.address : '',
      cafeName: resolvedCafe ? resolvedCafe.name : 'Our Cafe',
      cafeLogo: resolvedCafe ? resolvedCafe.logoUrl : '',
      cafeGstNumber: resolvedCafe ? resolvedCafe.gstNumber : '',
      cafeSupportNumber: resolvedCafe ? resolvedCafe.supportNumber : '',
      ownerId: resolvedOwnerId,
      customerId: customerPhone || customerEmail || '',
      invoiceId: 'INV-' + uniqueId,
      receiptId: 'REC-' + uniqueId,
      kotId: 'KOT-' + uniqueId,
      potId: 'POT-' + uniqueId,
      razorpayPaymentId: razorpayPaymentId || '',
      tableNumber: activeTableNumber,
      items: validatedItems,
      totalAmount: finalGrandTotal,
      status: 'Placed',
      customerName: customerName || '',
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || '',
      specialInstructions: specialInstructions || '',
      paymentStatus: paymentStatus || 'Pending',
      paymentMethod: paymentMethod || 'Pending',
      orderSource: normalizedOrderSource,
      createdBy: createdBy || '',
      createdByRole: createdByRole || '',
      subtotal: finalSubtotal,
      tax: finalTax,
      grandTotal: finalGrandTotal,
      source: normalizedSource,
      staffId: staffId || null
    });

    const savedOrder = await newOrder.save(useTransaction ? { session } : undefined);

    // If session transaction is active, commit the transaction!
    if (useTransaction && session) {
      await session.commitTransaction();
      session.endSession();
    }

    // 10. Auto update menu availability from inventory (run asynchronously in background)
    const activeBId = resolvedBranch ? resolvedBranch.branchId : 'default';
    updateMenuItemAvailabilityFromInventory(activeCafeId, null, activeBId)
      .catch(invErr => console.warn('Background menu availability update warning during order creation:', invErr.message));

    const formattedOrder = await appendLegacyFallback(savedOrder);

    // Broadcast the new order over socket
    await emitOrderUpdated(formattedOrder);

    return res.status(201).json({ success: true, data: formattedOrder });
  } catch (error) {
    if (useTransaction && session) {
      await session.abortTransaction();
      session.endSession();
    }
    error.controllerName = 'orderController';
    error.serviceName = 'createOrder';
    next(error);
  }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Public (Owner/Staff Dashboards)
const getOrders = async (req, res, next) => {
  try {
    const filterQuery = {};
    const cafeId = req.cafeId || req.query.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Missing cafeId' });
    }
    if (cafeId) filterQuery.cafeId = cafeId;

    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user?.role || '').toLowerCase());
    const queryBranch = req.query.branchId || req.headers['x-branch-id'];
    const activeBranchId = isStaff ? req.user?.assignedBranch : queryBranch;
    
    if (activeBranchId && activeBranchId !== 'all') {
      const branchDoc = await getCachedBranch(`mode:${activeBranchId}:${cafeId}`, () => Branch.findOne({
        $or: [
          { branchId: activeBranchId },
          { _id: mongoose.isValidObjectId(activeBranchId) ? activeBranchId : undefined }
        ],
        cafeId
      }).lean());

      if (branchDoc) {
        filterQuery.branchId = {
          $in: [
            branchDoc.branchId,
            String(branchDoc._id),
            branchDoc._id
          ]
        };
      } else {
        filterQuery.branchId = activeBranchId;
      }
    }

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

    const orders = await Order.find(filterQuery, null, { bypassBranchFilter: true }).sort({ createdAt: -1 }).limit(200).lean();
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
    error.controllerName = 'orderController';
    error.serviceName = 'getOrders';
    next(error);
  }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Public (Customer Live Tracker)
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const cafeId = req.cafeId || req.query.cafeId || (req.user && req.user.cafeId);
    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'Missing cafeId' });
    }
    
    let order = await Order.findOne({ _id: id, cafeId }, null, { bypassBranchFilter: true }).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found under this cafe context' });
    }
    
    const formattedOrder = await appendLegacyFallback(order);
    return res.status(200).json({ success: true, data: formattedOrder });
  } catch (error) {
    error.controllerName = 'orderController';
    error.serviceName = 'getOrderById';
    next(error);
  }
};

// @desc    Update order status
// @route   PATCH /api/orders/:id
// @access  Public (Owner Dashboard)
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status, paymentStatus, paymentMethod } = req.body;
    const { id } = req.params;

    const userRole = (req.user?.role || '').toLowerCase();
    const isOwnerOrAdmin = ['owner', 'admin', 'super_admin'].includes(userRole);

    // Strict Branch/Cafe Isolation Query
    if (!req.cafeId) {
      return res.status(400).json({ success: false, message: 'Missing cafeId' });
    }
    const query = { _id: id, cafeId: req.cafeId };
    if (!isOwnerOrAdmin) {
      query.branchId = req.branchId || 'default';
    }

    const order = await Order.findOne(query, null, { bypassBranchFilter: true });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found in this branch context' });
    }

    const activeBranchId = order.branchId || req.branchId || 'default';
    const branch = await getCachedBranch(`mode:${activeBranchId}:${req.cafeId}`, () => Branch.findOne({ 
      $or: [
        { branchId: activeBranchId },
        { _id: mongoose.isValidObjectId(activeBranchId) ? activeBranchId : undefined }
      ],
      cafeId: req.cafeId
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
      { returnDocument: 'after', runValidators: true, bypassBranchFilter: true }
    ).lean();

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order update failed or order not found' });
    }

    // Auto deduct inventory (run asynchronously in background to not block response)
    if (['Ready', 'Completed', 'Delivered'].includes(updatedOrder.status) && !updatedOrder.inventoryDeducted) {
      deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items)
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
    error.controllerName = 'orderController';
    error.serviceName = 'updateOrderStatus';
    next(error);
  }
};

// @desc    Update order payment method (Public for customers)
// @route   PATCH /api/orders/:id/payment-method
// @access  Public
const updateOrderPaymentMethod = async (req, res, next) => {
  try {
    const { paymentMethod } = req.body;
    const { id } = req.params;

    const allowedPaymentMethods = ['Online', 'Counter', 'Pending', 'Cash', 'UPI', 'Card'];
    if (!paymentMethod || !allowedPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({ success: false, message: `Invalid paymentMethod. Must be one of: ${allowedPaymentMethods.join(', ')}` });
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { _id: id },
      { paymentMethod, paymentStatus: 'Paid', paidAt: new Date() },
      { returnDocument: 'after', runValidators: true, bypassBranchFilter: true }
    ).lean();

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Deduct inventory (run asynchronously in background to not block response)
    deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items)
      .catch(err => console.warn('Background inventory deduction warning during payment update:', err.message));

    const formattedOrder = await appendLegacyFallback(updatedOrder);

    // Broadcast socket updates
    await emitOrderUpdated(formattedOrder);

    return res.status(200).json({ success: true, data: formattedOrder });
  } catch (error) {
    error.controllerName = 'orderController';
    error.serviceName = 'updateOrderPaymentMethod';
    next(error);
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  updateOrderPaymentMethod
};
