const express = require('express');
const router = express.Router();
const expenseController = require('../controllers/expenseController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

// All expense routes require authentication and owner/admin/manager role
router.use(protect);
router.use(restrictTo('owner', 'admin', 'manager', 'superadmin'));

router.get('/financial-summary', expenseController.getFinancialSummary);
router.get('/', expenseController.getExpenses);
router.post('/', expenseController.createExpense);
router.put('/:id', expenseController.updateExpense);
router.delete('/:id', expenseController.deleteExpense);

module.exports = router;
