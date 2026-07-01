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

// Protect all payroll routes with JWT session verification
router.use(protect);

// Generation endpoint (Owner/Admin only)
router.post('/generate', restrictTo('admin', 'owner'), generatePayroll);

// Report endpoint (Owner/Admin/Manager)
router.get('/report', restrictTo('admin', 'owner', 'manager'), getPayrollReport);

// General listings and current user details
router.get('/', listPayroll);
router.get('/current', getCurrentEmployeePayroll);
router.get('/history', getPayrollHistory);
router.get('/:id', getPayrollDetails);

// Modify and pay payroll (Owners/Managers/Admins)
router.patch('/:id', restrictTo('admin', 'owner'), updatePayroll);
router.patch('/:id/pay', restrictTo('admin', 'owner', 'manager'), payPayroll);

// Delete pending payroll logs (Owners/Admins)
router.delete('/:id', restrictTo('admin', 'owner'), deletePayroll);

module.exports = router;
