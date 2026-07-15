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
      path.startsWith('/cafe') ||
      path.includes('/branches');

    // For public order creation (POST /orders from QR scans), the request body's
    // branchId is the authoritative source (set from the QR code parameters stored
    // in sessionStorage). The x-branch-id header may come from stale localStorage
    // if an owner previously used the same browser for their dashboard.
    // We detect QR order requests by path + method, not by auth header, because
    // the Axios interceptor always sends a token if one exists in localStorage.
    const isOrderCreation = req.method === 'POST' && (path === '/orders' || path === '/orders/');
    let cafeId = req.headers['x-cafe-id'] || req.query?.cafeId || req.body?.cafeId;
    let branchId;
    if (isOrderCreation && req.body?.branchId) {
      // For order creation, body branchId takes priority (QR source of truth)
      branchId = req.body.branchId;
    } else {
      branchId = req.headers['x-branch-id'] || req.query?.branchId || req.body?.branchId || 'default';
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
          // Token verification failed or expired - ignore, user remains undefined
        }
      }
    }

    if (isExempt) {
      if (user) {
        cafeId = cafeId || user.cafeId || 'CD001';
        const role = (user.role || '').toLowerCase();
        if (['manager', 'chef', 'waiter', 'cashier', 'staff'].includes(role)) {
          branchId = branchId || user.assignedBranch || 'default';
        }
      } else {
        cafeId = cafeId || 'CD001';
        branchId = branchId || 'default';
      }
      runWithContext({ cafeId, branchId }, () => {
        req.cafeId = cafeId;
        req.branchId = branchId;
        next();
      });
      return;
    }

    if (user) {
      cafeId = user.cafeId || 'CD001';
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
        // Staff are strictly locked to their assigned branch - auto-coerce to prevent stale localStorage blocking
        const assignedBranch = user.assignedBranch || 'default';
        branchId = assignedBranch;
      } else if (['owner', 'admin'].includes(role)) {
        // Owners/admins must own the branch they are requesting
        // Checked via DB/cache query below (making sure branch exists under user's cafeId)
      }
    } else {
      if (!cafeId) {
        cafeId = 'CD001';
      }
    }

    // Unless exempt, verify that the branch exists and is active under cafeId
    if (!isExempt) {
      const isOwnerOrAdmin = user && ['owner', 'admin'].includes((user.role || '').toLowerCase());
      if (branchId === 'all' && isOwnerOrAdmin) {
        // Owners/admins bypass branch existence/active check for 'all' branch selection
      } else if (branchId === 'default') {
        // Default fallback branch is always allowed to prevent blocking new tenants before setup
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
