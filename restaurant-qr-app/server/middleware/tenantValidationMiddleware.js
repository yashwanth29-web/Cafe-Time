const Branch = require('../models/Branch');
const Cafe = require('../models/Cafe');
const OperationalConfig = require('../models/OperationalConfig');
const Order = require('../models/Order');
const mongoose = require('mongoose');

const validateTenant = async (req, res, next) => {
  try {
    const path = req.path;

    // Exempt path check (don't block global routes or auth routes)
    const isExempt = 
      path.startsWith('/auth') ||
      path.startsWith('/superadmin') ||
      path.startsWith('/health') ||
      path.includes('/branches');

    if (isExempt) {
      return next();
    }

    // Bypass check for super admins
    if (req.user && req.user.role === 'super_admin') {
      return next();
    }

    const cafeId = req.cafeId;
    const branchId = req.branchId;

    // 1. Validate cafeId exists and is active (not deleted)
    if (cafeId) {
      const cafe = await Cafe.findOne({ cafeId });
      if (!cafe) {
        return res.status(404).json({ success: false, message: `Cafe ID: ${cafeId} does not exist.` });
      }
      if (cafe.isDeleted) {
        return res.status(403).json({ success: false, message: `Access denied. Cafe has been deleted.` });
      }
      if (!cafe.isActive) {
        return res.status(403).json({ success: false, message: `Access denied. Cafe is currently inactive.` });
      }
    }

    // 2. Validate branch belongs to cafe
    if (branchId && branchId !== 'all') {
      const branch = await Branch.findOne({
        $or: [
          { branchId: branchId },
          { _id: mongoose.isValidObjectId(branchId) ? branchId : undefined }
        ],
        cafeId
      });

      if (!branch) {
        return res.status(404).json({ success: false, message: `Branch ID: ${branchId} does not belong to Cafe ID: ${cafeId}.` });
      }
      if (!branch.isActive) {
        return res.status(403).json({ success: false, message: `Access denied. Branch is currently inactive.` });
      }
    }

    // 3. Validate table belongs to branch if table parameter is present
    const tableId = req.query?.table || req.body?.tableNumber || req.body?.table;
    if (tableId && tableId !== 'Takeaway' && tableId !== 'Walk-in') {
      const opConfig = await OperationalConfig.findOne({ cafeId, branchId });
      if (opConfig) {
        const tableExists = opConfig.tables.some(t => 
          String(t.id).toLowerCase() === String(tableId).toLowerCase() || 
          String(t.label).toLowerCase() === String(tableId).toLowerCase()
        );
        if (!tableExists) {
          return res.status(400).json({ success: false, message: `Table ${tableId} does not exist in branch ${branchId}.` });
        }
      }
    }

    // 4. Validate Order belongs to branch/cafe if order ID is specified in the route
    const orderMatch = path.match(/\/orders\/([a-fA-F0-9]{24})/);
    if (orderMatch) {
      const orderId = orderMatch[1];
      if (mongoose.isValidObjectId(orderId)) {
        const order = await Order.findOne({ _id: orderId }, null, { bypassBranchFilter: true });
        if (order) {
          if (order.cafeId !== cafeId || (branchId !== 'all' && order.branchId !== branchId)) {
            return res.status(403).json({ success: false, message: 'Access denied. Order does not belong to this cafe/branch tenant.' });
          }
        }
      }
    }

    // 5. Validate MenuItem belongs to branch/cafe if menu item ID is specified in the route
    const menuMatch = path.match(/\/menu\/([a-fA-F0-9]{24})/);
    if (menuMatch) {
      const MenuItem = require('../models/MenuItem');
      const itemId = menuMatch[1];
      if (mongoose.isValidObjectId(itemId)) {
        const item = await MenuItem.findOne({ _id: itemId }, null, { bypassBranchFilter: true });
        if (item) {
          if (item.cafeId !== 'CD001' && item.cafeId !== cafeId) {
            return res.status(403).json({ success: false, message: 'Access denied. Menu item does not belong to this cafe/branch tenant.' });
          }
        }
      }
    }

    // 6. Validate Category belongs to branch/cafe if category ID is specified in the route
    const categoryMatch = path.match(/\/categories\/([a-fA-F0-9]{24})/);
    if (categoryMatch) {
      const Category = require('../models/Category');
      const catId = categoryMatch[1];
      if (mongoose.isValidObjectId(catId)) {
        const cat = await Category.findOne({ _id: catId }, null, { bypassBranchFilter: true });
        if (cat) {
          if (cat.cafeId !== 'CD001' && cat.cafeId !== cafeId) {
            return res.status(403).json({ success: false, message: 'Access denied. Category does not belong to this cafe/branch tenant.' });
          }
        }
      }
    }

    next();
  } catch (error) {
    console.error('[TENANT VALIDATION MIDDLEWARE ERROR]', error);
    res.status(500).json({ success: false, message: 'Internal validation error during tenant check' });
  }
};

module.exports = { validateTenant };
