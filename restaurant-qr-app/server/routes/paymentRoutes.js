const express = require('express');
const router = express.Router();
const { createOrder, verifyPayment, payExistingOrder } = require('../controllers/paymentController');

// Route to initiate order and get Razorpay credentials
router.post('/create-order', createOrder);

// Route to cryptographically verify payment signature and finalize order
router.post('/verify', verifyPayment);

// Route to initiate payment for an existing order
router.post('/pay-existing-order', payExistingOrder);

module.exports = router;
