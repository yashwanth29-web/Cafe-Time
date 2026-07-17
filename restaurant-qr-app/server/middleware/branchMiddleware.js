const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { runWithContext } = require('../utils/context');
const mongoose = require('mongoose');
const connectDB = require('../config/db');

// Helper to wait for DB connection and retry if disconnected
const waitDbConnection = async (timeoutMs = 5000) => {
  if (mongoose.connection.readyState === 1) return;

  if (mongoose.connection.readyState === 0) {
    console.log('[DB RECONNECT] Database is disconnected. Triggering reconnect...');
    connectDB().catch(err => console.error('[DB RECONNECT] Reconnection attempt failed:', err.message));
  }

  const startTime = Date.now();
  while (mongoose.connection.readyState !== 1) {
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Database connection is temporarily unavailable. Please try again in a few seconds.');
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
};

// Active branches in-memory cache with 60s TTL
const branchCache = new Map(); // Keyed by `${cafeId}_${branchId}` -> { isActive, exists, expiresAt }

const verifyBranchActive = async (cafeId, branchId) => {
  const cacheKey = `${cafeId}_${branchId}`;
  const cached = branchCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && cached.expiresAt > now) {
    return cached;
  }
  
  const branch = await Branch.findOne({
    $or: [
      { branchId: branchId },
      { _id: mongoose.isValidObjectId(branchId) ? branchId : undefined }
    ],
    cafeId
  });
  const result = {
    exists: !!branch,
    isActive: !!(branch && branch.isActive),
    expiresAt: now + 60000 // 60 seconds cache TTL
  };
  
  branchCache.set(cacheKey, result);
  return result;
};

const attachCafeAndBranch = async (req, res, next) => {
  try {
    // Wait for DB connection if transiently disconnected
    await waitDbConnection();

    // Exempt check
    const path = req.path;
    const isExempt = 
      path.startsWith('/auth') ||
      path.startsWith('/superadmin') ||
      path.startsWith('/health') ||
      path.includes('/branches');

    // For public order creation (POST /orders from QR scans), the request body's
    // branchId is the authoritative source (set from the QR code parameters stored
    // in sessionStorage).
    console.log(`\n--- INCOMING REQUEST CONTEXT LOG ---`);
    console.log(`Method/Path: ${req.method} ${req.originalUrl}`);
    console.log(`Incoming Query:`, req.query);
    console.log(`Incoming Body:`, req.body);

    const isOrderCreation = req.method === 'POST' && (path === '/orders' || path === '/orders/');
    let cafeId = req.headers['x-cafe-id'] || req.query?.cafeId || req.body?.cafeId;
    let branchId;
    if (isOrderCreation && req.body?.branchId) {
      branchId = req.body.branchId;
    } else {
      branchId = req.headers['x-branch-id'] || req.query?.branchId || req.body?.branchId;
    }

    // Resolve and self-heal identifiers immediately
    const { resolveIdentifiers } = require('../utils/tableHelper');
    const resolved = await resolveIdentifiers({
      cafeId,
      branchId,
      tableNumber: req.body?.tableNumber || req.query?.table || req.body?.table,
      tableId: req.body?.tableId || (req.query?.table && String(req.query.table).startsWith('T') ? req.query.table : '')
    });

    cafeId = resolved.cafeId;
    branchId = resolved.branchId;

    // Inject back into request body to satisfy Mongo schema validation requirements
    if (req.body && typeof req.body === 'object') {
      if (!req.body.cafeId) req.body.cafeId = cafeId;
      if (!isExempt && !req.body.branchId) req.body.branchId = branchId;
    }

    console.log(`Resolved Identifiers: cafeId="${cafeId}", branchId="${branchId}", tableId="${resolved.tableId}"`);
    console.log(`Body after context resolution:`, req.body);
    console.log(`-------------------------------------\n`);

    // Try to extract cafeId from URL path parameter for Cafe details endpoint e.g., /api/cafe/CD002
    if (!cafeId && path.startsWith('/cafe/')) {
      const parts = path.split('/');
      const potentialId = parts[2];
      if (potentialId && potentialId !== 'payment-info' && potentialId !== 'heartbeat') {
        cafeId = potentialId;
      }
    }

    // Try to extract cafeId and branchId from order if order ID is in path
    if (path.startsWith('/orders/')) {
      const parts = path.split('/');
      const orderId = parts[2];
      if (orderId && mongoose.isValidObjectId(orderId)) {
        const Order = require('../models/Order');
        const orderDoc = await Order.findById(orderId).lean();
        if (orderDoc) {
          cafeId = cafeId || orderDoc.cafeId;
          branchId = branchId || orderDoc.branchId;
        }
      }
    }

    // If req.user is already set by protect middleware, use it
    let user = req.user;

    // If req.user is NOT set, check if there is an Authorization header/cookie to decode user on the fly
    if (!user) {
      let token;
      if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
      } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_cafe_key_12345');
          user = await User.findById(decoded.id);
          if (user && user.isActive) {
            req.user = user; // Set it so subsequent handlers have it
          }
        } catch (e) {
          // Token verification failed or expired - ignore
        }
      }
    }

    if (user) {
      cafeId = cafeId || user.cafeId;
      const role = (user.role || '').toLowerCase();
      if (role === 'super_admin') {
        // Super admins bypass branch checks entirely
        runWithContext({ cafeId, branchId }, () => {
          req.cafeId = cafeId;
          req.branchId = branchId;
          next();
        });
        return;
      }

      if (['manager', 'chef', 'waiter', 'cashier', 'staff'].includes(role)) {
        branchId = user.assignedBranch || branchId;
      }
    }

    // Set branchId default to 'default' only if cafeId is set and branchId is not
    if (cafeId && !branchId) {
      branchId = 'default';
    }

    if (isExempt) {
      runWithContext({ cafeId, branchId }, () => {
        req.cafeId = cafeId;
        req.branchId = branchId;
        next();
      });
      return;
    }

    // Unless exempt, verify that the branch exists and is active under cafeId
    if (!isExempt) {
      if (!cafeId) {
        return res.status(400).json({ success: false, message: 'Missing cafeId context' });
      }
      const isOwnerOrAdmin = user && ['owner', 'admin'].includes((user.role || '').toLowerCase());
      if (branchId === 'all' && isOwnerOrAdmin) {
        // Owners/admins bypass branch existence/active check for 'all' branch selection
      } else if (branchId === 'default') {
        // Default fallback branch
      } else {
        const branchStatus = await verifyBranchActive(cafeId, branchId);
        if (!branchStatus.exists) {
          return res.status(404).json({
            success: false,
            message: `Branch ID: ${branchId} does not exist.`
          });
        }
        if (!branchStatus.isActive) {
          return res.status(403).json({
            success: false,
            message: `Access denied. Branch ID: ${branchId} is inactive.`
          });
        }
      }
    }

    runWithContext({ cafeId, branchId }, () => {
      req.cafeId = cafeId;
      req.branchId = branchId;
      next();
    });
  } catch (error) {
    console.error('attachCafeAndBranch error:', error);
    res.status(500).json({ success: false, message: 'Server error processing cafe/branch context' });
  }
};

module.exports = { attachCafeAndBranch };
