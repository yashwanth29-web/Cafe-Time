const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, payExistingOrder } = require('../controllers/paymentController');

router.post('/create-order', createOrder);
router.post('/verify', verifyPayment);
router.post('/pay-existing-order', payExistingOrder);

module.exports = router;
