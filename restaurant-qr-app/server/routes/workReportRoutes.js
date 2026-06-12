const express = require('express');
const router = express.Router();
const { createReport, getReports } = require('../controllers/workReportController');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer storage for work report image uploads
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
    cb(null, `report-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit per image
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

// Protect all routes under this namespace
router.use(protect);

// Staff submits a work report
router.post(
  '/submit',
  restrictTo('manager', 'chef', 'waiter', 'cashier', 'staff'),
  upload.array('photos', 10), // Up to 10 photos, form-data name is 'photos'
  createReport
);

// Owners/Managers view submitted reports
router.get(
  '/owner',
  restrictTo('admin', 'owner', 'manager'),
  getReports
);

module.exports = router;
