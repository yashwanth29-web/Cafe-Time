const express = require('express');
const router = express.Router();
const { 
  generatePayroll,
  listPayroll,
  getPayrollDetails,
  getCurrentEmployeePayroll,
  updatePayroll,
  payPayroll,
  deletePayroll,
  getPayrollHistory,
  getPayrollReport
} = require('../controllers/payrollController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// Protect all routes under /api/payroll to authenticated users
router.use(protect);

router.post('/generate', restrictTo('admin', 'owner'), generatePayroll);
router.get('/', restrictTo('admin', 'owner', 'manager', 'staff', 'chef', 'waiter', 'cashier'), listPayroll);
router.get('/current', restrictTo('admin', 'owner', 'manager', 'staff', 'chef', 'waiter', 'cashier'), getCurrentEmployeePayroll);
router.get('/history', restrictTo('admin', 'owner', 'manager', 'staff', 'chef', 'waiter', 'cashier'), getPayrollHistory);
router.get('/report', restrictTo('admin', 'owner'), getPayrollReport);
router.get('/:id', restrictTo('admin', 'owner', 'manager', 'staff', 'chef', 'waiter', 'cashier'), getPayrollDetails);
router.patch('/:id', restrictTo('admin', 'owner'), updatePayroll);
router.patch('/:id/pay', restrictTo('admin', 'owner'), payPayroll);
router.delete('/:id', restrictTo('admin', 'owner'), deletePayroll);

module.exports = router;
