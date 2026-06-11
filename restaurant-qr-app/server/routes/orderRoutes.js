const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderById, updateOrderStatus, updateOrderPaymentMethod } = require('../controllers/orderController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/', createOrder);
router.get('/', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'staff'), getOrders);
router.get('/:id', getOrderById);
router.patch('/:id/payment-method', updateOrderPaymentMethod);
router.patch('/:id', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'staff'), updateOrderStatus);

module.exports = router;
