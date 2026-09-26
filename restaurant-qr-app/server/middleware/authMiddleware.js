const jwt = require('jsonwebtoken');
const User = require('../models/User');

// In-memory 60s user profile cache to prevent repetitive DB queries on every concurrent API call
const userAuthCache = new Map();

/**
 * Invalidate cached user if updated (e.g. role/password changed)
 */
const invalidateUserCache = (userId) => {
  if (userId) userAuthCache.delete(String(userId));
};

/**
 * Protect middleware to verify JWT session and load user profile
 */
const protect = async (req, res, next) => {
  // Fast-path: If user was already decoded and attached by prior middleware
  if (req.user && req.user._id) {
    return next();
  }

  let token;

  // 1. Get token from cookies or authorization header
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Check if token exists
  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, login required' });
  }

  try {
    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_cafe_key_12345');
    const nowMs = Date.now();

    // 3. Fast memory cache check (60s TTL)
    let cached = userAuthCache.get(decoded.id);
    let user;
    if (cached && cached.expiresAt > nowMs) {
      user = cached.user;
    } else {
      user = await User.findById(decoded.id);
      if (user) {
        userAuthCache.set(decoded.id, {
          user,
          expiresAt: nowMs + 60000 // 60 seconds
        });
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'User account no longer exists' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact system admin.' });
    }

    // 4. Update lastSeen in background without blocking response
    const now = new Date();
    if (!user.lastSeen || (now - user.lastSeen) > 2 * 60 * 1000) {
      user.lastSeen = now;
      User.updateOne({ _id: user._id }, { $set: { lastSeen: now } }).catch(() => {});
    }

    // Attach user profile to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Verification error:', error);
    return res.status(401).json({ success: false, message: 'Not authorized, token verification failed' });
  }
};

/**
 * Restrict access to specific roles (case-insensitive)
 * @param {...string} roles - Permitted user roles
 */
const restrictTo = (...roles) => {
  const normalizedRoles = roles.map(r => r.toLowerCase());
  return (req, res, next) => {
    if (!req.user || !normalizedRoles.includes((req.user.role || '').toLowerCase())) {
      return res.status(403).json({ 
        success: false, 
        message: `Role unauthorized. Required: [${roles.join(', ')}]. Your role: ${req.user ? req.user.role : 'none'}` 
      });
    }
    next();
  };
};

module.exports = {
  protect,
  restrictTo,
  userAuthCache,
  invalidateUserCache
};
