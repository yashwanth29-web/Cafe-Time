const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Branch = require('../models/Branch');
const { runWithContext } = require('../utils/context');

// Active branches in-memory cache with 5s TTL
const branchCache = new Map(); // Keyed by `${cafeId}_${branchId}` -> { isActive, exists, expiresAt }

const verifyBranchActive = async (cafeId, branchId) => {
  const cacheKey = `${cafeId}_${branchId}`;
  const cached = branchCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && cached.expiresAt > now) {
    return cached;
  }
  
  const branch = await Branch.findOne({ branchId, cafeId });
  const result = {
    exists: !!branch,
    isActive: !!(branch && branch.isActive),
    expiresAt: now + 5000 // 5 seconds cache TTL
  };
  
  branchCache.set(cacheKey, result);
  return result;
};

const attachCafeAndBranch = async (req, res, next) => {
  try {
    // Exempt check
    const path = req.path;
    const isExempt = 
      path.startsWith('/auth') ||
      path.startsWith('/superadmin') ||
      path.startsWith('/health') ||
      path.startsWith('/cafe') ||
      path.includes('/branches');

    let cafeId = req.headers['x-cafe-id'] || req.query?.cafeId || req.body?.cafeId;
    let branchId = req.headers['x-branch-id'] || req.query?.branchId || req.body?.branchId || 'default';

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
        // Staff are strictly locked to their assigned branch
        const assignedBranch = user.assignedBranch || 'default';
        if (branchId !== assignedBranch) {
          return res.status(403).json({
            success: false,
            message: `Access denied. You are only permitted to access your assigned branch: ${assignedBranch}`
          });
        }
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
      const branchStatus = await verifyBranchActive(cafeId, branchId);
      if (!branchStatus.exists) {
        return res.status(403).json({
          success: false,
          message: `Unauthorized access. Branch ID: ${branchId} does not exist.`
        });
      }
      if (!branchStatus.isActive) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Branch ID: ${branchId} is inactive.`
        });
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
