const jwt = require('jsonwebtoken');
const User = require('../models/User');
const OtpVerification = require('../models/OtpVerification');
const Cafe = require('../models/Cafe');
const emailService = require('../services/emailService');

// Cookie options helper
const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

/**
 * Send OTP Code to User's Email
 */
const sendOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const isSuperAdmin = cleanEmail === (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();

    // If not super admin, check if user exists in the database
    if (!isSuperAdmin) {
      const user = await User.findOne({ email: cleanEmail });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Account not found. Contact App Owner.' });
      }
      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'This account has been deactivated.' });
      }
    }

    // Check if OTP record already exists for resend count check
    let otpRecord = await OtpVerification.findOne({ email: cleanEmail });
    if (otpRecord && otpRecord.resendCount >= 3) {
      // Check if it's expired. If expired, we can clear it and let them try again.
      if (otpRecord.expiresAt < new Date()) {
        await OtpVerification.deleteOne({ email: cleanEmail });
        otpRecord = null;
      } else {
        return res.status(429).json({ 
          success: false, 
          message: 'Maximum resend attempts reached. Please wait for the current code to expire.' 
        });
      }
    }

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

    if (otpRecord) {
      // Update existing record
      otpRecord.otp = otp;
      otpRecord.expiresAt = expiresAt;
      // Note: we do not increment resendCount on initial send, only on resend-otp
      await otpRecord.save();
    } else {
      // Create new record
      await OtpVerification.create({
        email: cleanEmail,
        otp,
        expiresAt,
        resendCount: 0
      });
    }

    // Log the generated OTP to console for easy developer bypass / testing
    console.log('--- GENERATED OTP FOR DEV BYPASS ---');
    console.log('Email:', cleanEmail, 'OTP:', otp);
    console.log('------------------------------------');

    // Send email via Nodemailer
    await emailService.sendOTP(cleanEmail, otp);

    return res.status(200).json({ 
      success: true, 
      message: 'Verification code sent to your email successfully.' 
    });
  } catch (error) {
    console.error('sendOTP controller error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Server error initiating OTP send' });
  }
};

/**
 * Verify OTP Code and Generate JWT Session Cookie
 */
const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and verification code are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp = otp.trim();

  try {
    const isSuperAdmin = cleanEmail === (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();

    // Check for OTP verification record
    const otpRecord = await OtpVerification.findOne({ email: cleanEmail });
    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Verification request expired or invalid code' });
    }

    // Check expiration
    if (otpRecord.expiresAt < new Date()) {
      await OtpVerification.deleteOne({ email: cleanEmail });
      return res.status(400).json({ success: false, message: 'Verification code has expired. Request a new one.' });
    }

    // Validate OTP match
    if (otpRecord.otp !== cleanOtp) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please check and try again.' });
    }

    // Delete OTP record since it's verified successfully
    await OtpVerification.deleteOne({ email: cleanEmail });

    let user;

    if (isSuperAdmin) {
      // Find or create the Super Admin account
      user = await User.findOne({ email: cleanEmail });
      if (!user) {
        user = await User.create({
          name: 'Super Admin',
          email: cleanEmail,
          phone: 'N/A',
          role: 'super_admin',
          cafeId: '',
          isActive: true
        });
      }
    } else {
      user = await User.findOne({ email: cleanEmail });
      if (!user) {
        return res.status(404).json({ success: false, message: 'User account not found' });
      }
      if (!user.isActive) {
        return res.status(401).json({ success: false, message: 'This account has been deactivated.' });
      }
    }

    // Update login timestamps
    const now = new Date();
    user.lastLogin = now;
    user.lastSeen = now;
    await user.save();

    // Sign JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role, cafeId: user.cafeId },
      process.env.JWT_SECRET || 'super_secret_cafe_key_12345',
      { expiresIn: '7d' }
    );

    // Save token in cookie
    res.cookie('token', token, getCookieOptions());

    let setupCompleted = false;
    if (user.cafeId) {
      const cafe = await Cafe.findOne({ cafeId: user.cafeId });
      if (cafe) {
        setupCompleted = cafe.setupCompleted;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        cafeId: user.cafeId,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        lastSeen: user.lastSeen,
        setupCompleted
      },
      token // Fallback return token to frontend in case they store in local storage too
    });
  } catch (error) {
    console.error('verifyOTP controller error:', error);
    return res.status(500).json({ success: false, message: 'Server error verifying OTP' });
  }
};

/**
 * Resend OTP Code (max 3 resends)
 */
const resendOTP = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const otpRecord = await OtpVerification.findOne({ email: cleanEmail });
    
    // Check if they exceed the resend count limit (max 3 resends)
    if (otpRecord && otpRecord.resendCount >= 3) {
      if (otpRecord.expiresAt < new Date()) {
        // Expired, clear and recreate
        await OtpVerification.deleteOne({ email: cleanEmail });
      } else {
        return res.status(429).json({ 
          success: false, 
          message: 'Maximum resend attempts reached. Please wait for the current code to expire.' 
        });
      }
    }

    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    if (otpRecord) {
      otpRecord.otp = otp;
      otpRecord.expiresAt = expiresAt;
      otpRecord.resendCount += 1;
      await otpRecord.save();
    } else {
      await OtpVerification.create({
        email: cleanEmail,
        otp,
        expiresAt,
        resendCount: 1 // Counted as first resend
      });
    }

    // Log the generated OTP to console for easy developer bypass / testing
    console.log('--- GENERATED RESEND OTP FOR DEV BYPASS ---');
    console.log('Email:', cleanEmail, 'OTP:', otp);
    console.log('-------------------------------------------');

    // Send email via Nodemailer
    await emailService.sendOTP(cleanEmail, otp);

    return res.status(200).json({ 
      success: true, 
      message: 'New verification code has been sent successfully.',
      resendCount: otpRecord ? otpRecord.resendCount + 1 : 1
    });
  } catch (error) {
    console.error('resendOTP controller error:', error);
    return res.status(500).json({ success: false, message: 'Server error resending OTP' });
  }
};

/**
 * Log Out User and Clear Cookie
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
 */
const getMe = async (req, res) => {
  // User is already attached by protect middleware
  let setupCompleted = false;
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
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      role: req.user.role,
      cafeId: req.user.cafeId,
      isActive: req.user.isActive,
      lastLogin: req.user.lastLogin,
      lastSeen: req.user.lastSeen,
      setupCompleted
    }
  });
};

module.exports = {
  sendOTP,
  verifyOTP,
  resendOTP,
  logout,
  getMe
};
