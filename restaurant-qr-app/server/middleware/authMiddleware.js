const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect middleware to verify JWT session and load user profile
 */
const protect = async (req, res, next) => {
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

    // 3. Find user in database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User account no longer exists' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact system admin.' });
    }

    // 4. Update lastSeen with throttling (only write to DB if lastSeen is older than 2 minutes)
    const now = new Date();
    if (!user.lastSeen || (now - user.lastSeen) > 2 * 60 * 1000) {
      user.lastSeen = now;
      await user.save();
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
 * Restrict access to specific roles
 * @param {...string} roles - Permitted user roles ('super_admin', 'admin', 'staff')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
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
  restrictTo
};
