const express = require('express');
const router = express.Router();
const { getCategories, createCategory, updateCategory, deleteCategory, reorderCategories } = require('../controllers/categoryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.get('/', getCategories);
router.post('/', protect, restrictTo('admin', 'owner', 'superadmin'), createCategory);
router.put('/reorder', protect, restrictTo('admin', 'owner', 'superadmin'), reorderCategories);
router.patch('/:id', protect, restrictTo('admin', 'owner', 'superadmin'), updateCategory);
router.delete('/:id', protect, restrictTo('admin', 'owner', 'superadmin'), deleteCategory);

module.exports = router;
