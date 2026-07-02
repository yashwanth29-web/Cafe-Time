const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Branch = require('../models/Branch');

const attachCafeAndBranch = async (req, res, next) => {
  try {
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

    if (user) {
      cafeId = user.cafeId || 'CD001';
      const role = (user.role || '').toLowerCase();
      
      if (['manager', 'chef', 'waiter', 'cashier', 'staff'].includes(role)) {
        // Staff are strictly locked to their assigned branch
        branchId = user.assignedBranch || 'default';
      } else if (['owner', 'admin'].includes(role)) {
        // Owners/admins must own the branch they are requesting
        if (branchId && branchId !== 'default') {
          const branch = await Branch.findOne({ branchId, cafeId });
          if (!branch) {
            // If they try to request a branch they do not own, restrict access
            return res.status(403).json({
              success: false,
              message: `Unauthorized access to branch ID: ${branchId}`
            });
          }
        }
      }
    } else {
      if (!cafeId) {
        cafeId = 'CD001';
      }
    }

    req.cafeId = cafeId;
    req.branchId = branchId;
    next();
  } catch (error) {
    console.error('attachCafeAndBranch error:', error);
    res.status(500).json({ success: false, message: 'Server error processing cafe/branch context' });
  }
};

module.exports = { attachCafeAndBranch };
