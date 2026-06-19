const express = require('express');
const router = express.Router();
const { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer storage for menu item image uploads
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
    cb(null, `dish-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 } // Limit dish images to 5MB
});

router.get('/', getMenuItems);
router.post('/', protect, restrictTo('admin', 'owner', 'manager'), createMenuItem);
router.post('/upload-image', protect, restrictTo('admin', 'owner', 'manager'), upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file uploaded' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  return res.status(200).json({
    success: true,
    imageUrl
  });
});
router.patch('/:id', protect, restrictTo('admin', 'owner', 'manager'), updateMenuItem);
router.delete('/:id', protect, restrictTo('admin', 'owner', 'manager'), deleteMenuItem);

module.exports = router;
