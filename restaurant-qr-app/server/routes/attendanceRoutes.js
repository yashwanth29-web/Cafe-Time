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

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer storage for check-in selfie uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `attendance-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // Limit selfie to 2MB
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/i;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only JPG, JPEG, PNG, and WEBP formats are supported!'));
    }
  }
});

// Protect all routes
router.use(protect);

// Staff Attendance Endpoints
router.post('/check-in', upload.single('image'), checkIn);
router.post('/check-out', checkOut);
router.get('/today', getTodayStatus);
router.get('/history', getStaffHistory);

// Owner/Manager Attendance Endpoints
router.get('/owner/today', restrictTo('admin', 'owner', 'manager'), getOwnerTodayDashboard);
router.get('/owner/reports', restrictTo('admin', 'owner', 'manager'), getOwnerReports);

module.exports = router;
