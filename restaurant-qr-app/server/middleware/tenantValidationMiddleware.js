const Branch = require('../models/Branch');
const Cafe = require('../models/Cafe');
const OperationalConfig = require('../models/OperationalConfig');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// In-memory 60s validation caches to avoid redundant DB roundtrips on every API call
const cafeValidationCache = new Map();
const branchValidationCache = new Map();

const validateTenant = async (req, res, next) => {
  try {
    const path = req.path;

    // Exempt path check (don't block global routes or auth routes)
    const isExempt = 
      path.startsWith('/auth') ||
      path.startsWith('/superadmin') ||
      path.startsWith('/health') ||
      path.startsWith('/cafe') ||
      path.startsWith('/admin/setup') ||
      path.startsWith('/notifications') ||
      path.includes('/branches');

    if (isExempt) {
      return next();
    }

    console.log(`[TENANT VALIDATION] Body entering middleware for path "${path}":`, req.body);

    // Bypass check for super admins
    if (req.user && req.user.role === 'super_admin') {
      return next();
    }

    const cafeId = req.cafeId;
    const branchId = req.branchId;

    const now = Date.now();

    // 1. Validate cafeId exists and is active (not deleted) with 60s memory cache
    if (cafeId) {
      let cafeInfo = cafeValidationCache.get(cafeId);
      if (!cafeInfo || cafeInfo.expiresAt <= now) {
        const cafe = await Cafe.findOne({ cafeId }).lean();
        cafeInfo = {
          exists: !!cafe,
          isDeleted: !!(cafe && cafe.isDeleted),
          isActive: !!(cafe && cafe.isActive),
          expiresAt: now + 60000 // 60s TTL
        };
        cafeValidationCache.set(cafeId, cafeInfo);
      }

      if (!cafeInfo.exists) {
        return res.status(404).json({ success: false, message: `Cafe ID: ${cafeId} does not exist.` });
      }
      if (cafeInfo.isDeleted) {
        return res.status(403).json({ success: false, message: `Access denied. Cafe has been deleted.` });
      }
      if (!cafeInfo.isActive) {
        return res.status(403).json({ success: false, message: `Access denied. Cafe is currently inactive.` });
      }
    }

    // 2. Validate branch belongs to cafe with 60s memory cache
    if (branchId && branchId !== 'all') {
      const branchKey = `${cafeId}_${branchId}`;
      let branchInfo = branchValidationCache.get(branchKey);
      if (!branchInfo || branchInfo.expiresAt <= now) {
        const branch = await Branch.findOne({
          $or: [
            { branchId: branchId },
            { _id: mongoose.isValidObjectId(branchId) ? branchId : undefined }
          ],
          cafeId
        }).lean();

        branchInfo = {
          exists: !!branch,
          isActive: !!(branch && branch.isActive),
          expiresAt: now + 60000 // 60s TTL
        };
        branchValidationCache.set(branchKey, branchInfo);
      }

      if (!branchInfo.exists) {
        console.warn(`[TENANT VALIDATION] Branch ID "${branchId}" does not belong to Cafe ID "${cafeId}". Auto-resolving to 'all'.`);
        req.branchId = 'all';
      } else if (!branchInfo.isActive) {
        return res.status(403).json({ success: false, message: `Access denied. Branch is currently inactive.` });
      }
    }

    // 3. Validate table belongs to branch if table parameter is present
    const tableId = req.query?.table || req.body?.tableNumber || req.body?.table;
    if (tableId && tableId !== 'Takeaway' && tableId !== 'Walk-in') {
      const { resolveAndSelfHealTable } = require('../utils/tableHelper');
      const resolvedTable = await resolveAndSelfHealTable(cafeId, branchId, tableId);
      if (!resolvedTable) {
        return res.status(400).json({ success: false, message: `Table ${tableId} does not exist in branch ${branchId}.` });
      }
      // Put resolved table details on the request so controllers can use it directly
      req.resolvedTable = resolvedTable;
    }

    // 4. Validate Order belongs to branch/cafe if order ID is specified in the route
    const orderMatch = path.match(/\/orders\/([a-fA-F0-9]{24})/);
    if (orderMatch) {
      const orderId = orderMatch[1];
      if (mongoose.isValidObjectId(orderId)) {
        const order = await Order.findOne({ _id: orderId }, null, { bypassBranchFilter: true });
        if (order) {
          // Resolve both order.branchId and context branchId to their canonical database ObjectIds
          const orderBranch = await Branch.findOne({
            $or: [
              { branchId: order.branchId },
              { _id: mongoose.isValidObjectId(order.branchId) ? order.branchId : undefined }
            ]
          }).lean();
          
          const contextBranch = await Branch.findOne({
            $or: [
              { branchId: branchId },
              { _id: mongoose.isValidObjectId(branchId) ? branchId : undefined }
            ]
          }).lean();

          const orderBranchObjectId = orderBranch ? String(orderBranch._id) : order.branchId;
          const contextBranchObjectId = contextBranch ? String(contextBranch._id) : branchId;

          if (order.cafeId !== cafeId || (branchId !== 'all' && orderBranchObjectId !== contextBranchObjectId)) {
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

    console.log(`[TENANT VALIDATION SUCCESS] Body after middleware:`, req.body);
    next();
  } catch (error) {
    console.error('[TENANT VALIDATION MIDDLEWARE ERROR]', error);
    res.status(500).json({ success: false, message: 'Internal validation error during tenant check' });
  }
};

module.exports = { validateTenant };
