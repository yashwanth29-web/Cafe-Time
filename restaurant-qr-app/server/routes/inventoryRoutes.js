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
  getConsumptionReport
} = require('../controllers/inventoryController');
const { 
  getInventoryCategories,
  createInventoryCategory,
  deleteInventoryCategory
} = require('../controllers/inventoryCategoryController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/', restrictTo('super_admin', 'admin', 'owner', 'manager', 'chef', 'waiter', 'staff', 'cashier'), getInventory);
router.post('/', restrictTo('super_admin', 'admin', 'owner'), createInventoryItem);
router.patch('/:id', restrictTo('super_admin', 'admin', 'owner', 'manager'), updateInventoryItem);
router.delete('/:id', restrictTo('super_admin', 'admin', 'owner'), deleteInventoryItem);

// Advanced stock operations & logs
router.get('/logs', restrictTo('super_admin', 'admin', 'owner', 'manager'), getInventoryLogs);
router.post('/purchase', restrictTo('super_admin', 'admin', 'owner', 'manager'), recordPurchase);
router.post('/wastage', restrictTo('super_admin', 'admin', 'owner', 'manager'), recordWastage);
router.post('/shortage', restrictTo('super_admin', 'admin', 'owner', 'manager', 'chef'), reportShortage);

// Inventory Category routes
router.get('/categories', restrictTo('super_admin', 'admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'staff'), getInventoryCategories);
router.post('/categories', restrictTo('super_admin', 'admin', 'owner'), createInventoryCategory);
router.delete('/categories/:id', restrictTo('super_admin', 'admin', 'owner'), deleteInventoryCategory);

// Reports
router.get('/reports/wastage', restrictTo('super_admin', 'admin', 'owner', 'manager'), getWastageReport);
router.get('/reports/consumption', restrictTo('super_admin', 'admin', 'owner', 'manager'), getConsumptionReport);

module.exports = router;
