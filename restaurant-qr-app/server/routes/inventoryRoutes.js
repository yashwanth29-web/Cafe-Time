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

router.get('/', restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'staff', 'cashier'), getInventory);
router.post('/', restrictTo('admin', 'owner'), createInventoryItem);
router.patch('/:id', restrictTo('admin', 'owner', 'manager'), updateInventoryItem);
router.delete('/:id', restrictTo('admin', 'owner'), deleteInventoryItem);

// Advanced stock operations & logs
router.get('/logs', restrictTo('admin', 'owner', 'manager'), getInventoryLogs);
router.post('/purchase', restrictTo('admin', 'owner', 'manager'), recordPurchase);
router.post('/wastage', restrictTo('admin', 'owner', 'manager'), recordWastage);
router.post('/shortage', restrictTo('admin', 'owner', 'manager', 'chef'), reportShortage);

// Inventory Category routes
router.get('/categories', restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'staff'), getInventoryCategories);
router.post('/categories', restrictTo('admin', 'owner'), createInventoryCategory);
router.delete('/categories/:id', restrictTo('admin', 'owner'), deleteInventoryCategory);

// Reports
router.get('/reports/wastage', restrictTo('admin', 'owner', 'manager'), getWastageReport);
router.get('/reports/consumption', restrictTo('admin', 'owner', 'manager'), getConsumptionReport);

module.exports = router;
