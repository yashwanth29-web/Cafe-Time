const express = require('express');
const router = express.Router();
const { createOwner, getCafes, updateCafe, deleteCafe } = require('../controllers/superAdminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Protect all routes under /api/superadmin to only super_admin role
router.use(protect);
router.use(restrictTo('super_admin'));

router.post('/create-owner', createOwner);
router.get('/cafes', getCafes);
router.put('/cafe/:id', updateCafe);
router.delete('/cafe/:id', deleteCafe);

module.exports = router;
