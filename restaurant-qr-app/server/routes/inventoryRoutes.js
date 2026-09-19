const express = require('express');
const router = express.Router();
const { 
  getInventory, 
  createInventoryItem, 
  updateInventoryItem, 
  deleteInventoryItem,
  getInventoryLogs,
  recordPurchase,
  recordWastage,
  reportShortage,
  getWastageReport,
  getConsumptionReport,
  revertInventoryLog
} = require('../controllers/inventoryController');
const { 
  getInventoryCategories,
  createInventoryCategory,
  deleteInventoryCategory
} = require('../controllers/inventoryCategoryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All staff roles allowed for inventory management
const ALL_STAFF = ['super_admin', 'admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff'];
const ADMIN_ONLY = ['super_admin', 'admin', 'owner'];

router.use(protect);

// Inventory CRUD
router.get('/', restrictTo(...ALL_STAFF), getInventory);
router.post('/', restrictTo(...ALL_STAFF), createInventoryItem);        // Staff can add items
router.patch('/:id', restrictTo(...ALL_STAFF), updateInventoryItem);   // Staff can edit items
router.delete('/:id', restrictTo(...ADMIN_ONLY), deleteInventoryItem); // Only admin/owner can delete

// Advanced stock operations & logs — all staff can purchase, wastage, shortage, revert
router.get('/logs', restrictTo(...ALL_STAFF), getInventoryLogs);
router.delete('/logs/:id', restrictTo(...ALL_STAFF), revertInventoryLog);
router.post('/logs/:id/revert', restrictTo(...ALL_STAFF), revertInventoryLog);
router.post('/purchase', restrictTo(...ALL_STAFF), recordPurchase);
router.post('/wastage', restrictTo(...ALL_STAFF), recordWastage);
router.post('/shortage', restrictTo(...ALL_STAFF), reportShortage);

// Inventory Category routes
router.get('/categories', restrictTo(...ALL_STAFF), getInventoryCategories);
router.post('/categories', restrictTo(...ALL_STAFF), createInventoryCategory);
router.delete('/categories/:id', restrictTo(...ADMIN_ONLY), deleteInventoryCategory);

// Reports — all staff can view
router.get('/reports/wastage', restrictTo(...ALL_STAFF), getWastageReport);
router.get('/reports/consumption', restrictTo(...ALL_STAFF), getConsumptionReport);

module.exports = router;

