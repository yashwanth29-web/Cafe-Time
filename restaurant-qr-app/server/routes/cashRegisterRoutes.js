const express = require('express');
const router = express.Router();
const cashRegisterController = require('../controllers/cashRegisterController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect);
router.use(restrictTo('owner', 'admin', 'manager', 'superadmin'));

router.get('/', cashRegisterController.getCashRegister);
router.post('/', cashRegisterController.saveCashRegister);
router.delete('/:id', cashRegisterController.deleteCashRegister);

module.exports = router;
