const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Cafe = require('../models/Cafe');

// Cookie options helper
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

/**
 * Format user payload for client responses (no sensitive info)
 */
const formatUserPayload = (user, setupCompleted = true) => ({
  id: user._id,
  name: user.displayName || user.name || user.username,
  displayName: user.displayName || user.name || user.username,
  username: user.username,
  email: user.email || '',
  phone: user.phone || '',
  role: user.role,
  staffRole: user.staffRole || '',
  employeeId: user.employeeId || '',
  cafeId: user.cafeId || '',
  assignedBranch: user.assignedBranch || '',
  branchId: user.assignedBranch || '',
  salaryType: user.salaryType || 'DAILY',
  dailyRate: user.dailyRate !== undefined ? user.dailyRate : 0,
  hourlyRate: user.hourlyRate !== undefined ? user.hourlyRate : 0,
  weeklyRate: user.weeklyRate !== undefined ? user.weeklyRate : 0,
  monthlyRate: user.monthlyRate !== undefined ? user.monthlyRate : 0,
  requiredHours: user.requiredHours || 8,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword || false,
  lastLogin: user.lastLogin,
  lastSeen: user.lastSeen,
  setupCompleted
});

/**
 * Username + Password Login for Super Admin, Admin, and Staff
 * POST /api/auth/login
 */
const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ 
      success: false, 
      message: 'Username and password are required' 
    });
  }

  const cleanUsername = username.trim().toLowerCase();

  try {
    // 1. Find user by username and explicitly include the password hash
    const user = await User.findOne({ username: cleanUsername }).select('+password');

    // 2. Generic invalid credential protection against enumeration
    if (!user || !user.password) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }

    // 3. Verify active status
    if (!user.isActive) {
      return res.status(401).json({ 
        success: false, 
        message: 'This account has been deactivated. Please contact your cafe administrator.' 
      });
    }

    // 4. Check if associated cafe is soft-deleted
    if (user.cafeId) {
      const cafe = await Cafe.findOne({ cafeId: user.cafeId });
      if (cafe && cafe.isDeleted) {
        return res.status(401).json({ 
          success: false, 
          message: 'Access denied. The cafe associated with this account has been deleted.' 
        });
      }
    }

    // 5. Verify password hash with bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }

    // 6. Update login and activity timestamps
    const now = new Date();
    user.lastLogin = now;
    user.lastSeen = now;
    await user.save();

    // 7. Sign 7-day JWT Token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username,
        role: user.role, 
        cafeId: user.cafeId,
        assignedBranch: user.assignedBranch || ''
      },
      process.env.JWT_SECRET || 'super_secret_cafe_key_12345',
      { expiresIn: '7d' }
    );

    // 8. Set HTTP-only Cookie
    res.cookie('token', token, getCookieOptions());

    // 9. Determine setup completion
    let setupCompleted = true;
    if (user.cafeId) {
      const cafe = await Cafe.findOne({ cafeId: user.cafeId });
      if (cafe) {
        setupCompleted = cafe.setupCompleted;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      user: formatUserPayload(user, setupCompleted),
      token
    });
  } catch (error) {
    console.error('Login controller error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error processing login request' 
    });
  }
};

/**
 * Change Password (for logged-in users)
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ 
      success: false, 
      message: 'Current password and new password are required' 
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: 'New password must be at least 6 characters long' 
    });
  }

  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ 
        success: false, 
        message: 'Incorrect current password' 
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.mustChangePassword = false;
    await user.save();

    return res.status(200).json({ 
      success: true, 
      message: 'Password changed successfully' 
    });
  } catch (error) {
    console.error('changePassword error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating password' });
  }
};

/**
 * Log Out User and Clear Cookie
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return res.status(200).json({ success: true, message: 'Logged out successfully' });
};

/**
 * Get Current Logged-in User Profile Details
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  let setupCompleted = true;
  try {
    if (req.user.cafeId) {
      const cafe = await Cafe.findOne({ cafeId: req.user.cafeId });
      if (cafe) {
        setupCompleted = cafe.setupCompleted;
      }
    }
  } catch (err) {
    console.error('getMe cafe lookup error:', err.message);
  }

  return res.status(200).json({
    success: true,
    user: formatUserPayload(req.user, setupCompleted)
  });
};

module.exports = {
  login,
  changePassword,
  logout,
  getMe
};
