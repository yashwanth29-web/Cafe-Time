const express = require('express');
const router = express.Router();
const { createReview, getReviews } = require('../controllers/reviewController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.post('/', createReview);
router.get('/', protect, restrictTo('admin', 'owner', 'manager'), getReviews);

module.exports = router;
