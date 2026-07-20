const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderById, updateOrderStatus, updateOrderPaymentMethod, printOrderReceipt } = require('../controllers/orderController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/', createOrder);
router.get('/', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'staff'), getOrders);
router.post('/:id/print', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'staff'), printOrderReceipt);
router.get('/:id', getOrderById);
router.patch('/:id/payment-method', updateOrderPaymentMethod);
router.patch('/:id', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'staff'), updateOrderStatus);
router.patch('/:id/status', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'staff'), updateOrderStatus);

module.exports = router;
