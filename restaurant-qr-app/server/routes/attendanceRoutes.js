const express = require('express');
const router = express.Router();
const { 
  checkIn, 
  checkOut, 
  getTodayStatus, 
  getStaffHistory,
  getOwnerTodayDashboard,
  getOwnerReports
} = require('../controllers/attendanceController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Protect all routes
router.use(protect);

// Staff Attendance Endpoints
router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/today', getTodayStatus);
router.get('/history', getStaffHistory);

// Owner/Manager Attendance Endpoints
router.get('/owner/today', restrictTo('admin', 'owner', 'manager'), getOwnerTodayDashboard);
router.get('/owner/reports', restrictTo('admin', 'owner', 'manager'), getOwnerReports);

module.exports = router;
