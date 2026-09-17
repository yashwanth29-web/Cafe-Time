const express = require('express');
const router = express.Router();
const { login, changePassword, logout, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public authentication endpoint
router.post('/login', login);
router.post('/logout', logout);

// Protected user profile & security endpoints
router.get('/me', protect, getMe);
router.post('/change-password', protect, changePassword);

module.exports = router;
