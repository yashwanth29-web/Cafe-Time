const express = require('express');
const router = express.Router();
const { sendOTP, verifyOTP, resendOTP, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public endpoints
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/logout', logout);

// Protected endpoint to fetch current user profile
router.get('/me', protect, getMe);

module.exports = router;
