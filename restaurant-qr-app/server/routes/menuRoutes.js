const express = require('express');
const router = express.Router();
const { getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/', getMenuItems);
router.post('/', protect, restrictTo('admin', 'owner', 'manager'), createMenuItem);
router.patch('/:id', protect, restrictTo('admin', 'owner', 'manager'), updateMenuItem);
router.delete('/:id', protect, restrictTo('admin', 'owner', 'manager'), deleteMenuItem);

module.exports = router;
