const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { 
  createStaff, 
  getStaff, 
  verifyRazorpay, 
  getSetupData, 
  saveSetupData, 
  updateOwnerProfile,
  getBranches,
  createBranch,
  getStaffSummary,
  uploadLogo 
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Protect all routes under /api/admin to only cafe owner (admin) role
router.use(protect);
router.use(restrictTo('admin'));

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
router.post('/create-staff', createStaff);
router.get('/staff', getStaff);
router.get('/staff-summary', getStaffSummary);

// Branches Management Routes
router.get('/branches', getBranches);
router.post('/branches', createBranch);

// Profile Management Route
router.put('/profile/owner', updateOwnerProfile);

// Onboarding Setup routes
router.get('/setup', getSetupData);
router.post('/setup', saveSetupData);
router.post('/verify-razorpay', verifyRazorpay);
router.post('/upload-logo', upload.single('logo'), uploadLogo);

module.exports = router;
