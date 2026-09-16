const express = require('express');
const router = express.Router();
const { createOrder, getOrders, getOrderById, updateOrderStatus, updateOrderPaymentMethod, printOrderReceipt, deleteOrder, updateOrderDetails } = require('../controllers/orderController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/', createOrder);
router.get('/', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff'), getOrders);
router.post('/:id/print', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff'), printOrderReceipt);
router.get('/:id', getOrderById);
router.put('/:id', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff'), updateOrderDetails);
router.delete('/:id', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff'), deleteOrder);
router.patch('/:id/payment-method', updateOrderPaymentMethod);
router.patch('/:id', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff'), updateOrderStatus);
router.patch('/:id/status', protect, restrictTo('admin', 'owner', 'manager', 'chef', 'waiter', 'cashier', 'waiter_cashier', 'staff'), updateOrderStatus);

module.exports = router;
