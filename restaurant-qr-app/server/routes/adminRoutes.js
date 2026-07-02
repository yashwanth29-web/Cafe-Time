const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { 
  createStaff, 
  getStaff, 
  updateStaff,
  deleteStaff,
  getSetupData, 
  saveSetupData, 
  updateOwnerProfile,
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getStaffSummary,
  uploadLogo,
  updateCafeTheme
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Protect all routes under /api/admin to authenticated users
router.use(protect);

// Configure Multer storage for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const cafeId = req.user ? req.user.cafeId : 'cafe';
    const ext = path.extname(file.originalname) || '.png';
    // Clean filename using the unique cafeId
    cb(null, `${cafeId}_logo${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 } // Limit logo to 2MB
});

// Staff Management Routes
router.post('/create-staff', restrictTo('admin', 'owner'), createStaff);
router.get('/staff', restrictTo('admin', 'owner', 'manager'), getStaff);
router.put('/staff/:id', restrictTo('admin', 'owner'), updateStaff);
router.delete('/staff/:id', restrictTo('admin', 'owner'), deleteStaff);
router.get('/staff-summary', restrictTo('admin', 'owner', 'manager'), getStaffSummary);

// Branches Management Routes
router.get('/branches', restrictTo('admin', 'owner'), getBranches);
router.post('/branches', restrictTo('admin', 'owner'), createBranch);
router.put('/branches/:id', restrictTo('admin', 'owner'), updateBranch);
router.delete('/branches/:id', restrictTo('admin', 'owner'), deleteBranch);

// Profile Management Route
router.put('/profile/owner', restrictTo('admin', 'owner'), updateOwnerProfile);

// Onboarding Setup routes
router.get('/setup', restrictTo('admin', 'owner'), getSetupData);
router.post('/setup', restrictTo('admin', 'owner'), saveSetupData);
router.post('/upload-logo', restrictTo('admin', 'owner'), upload.single('logo'), uploadLogo);
router.put('/theme', restrictTo('admin', 'owner'), updateCafeTheme);

module.exports = router;
