const Review = require('../models/Review');
const Order = require('../models/Order');

// @desc    Create a new customer review
// @route   POST /api/reviews
// @access  Public (Customer checkout completed flow)
const createReview = async (req, res) => {
  try {
    const { orderId, rating, reviewText } = req.body;

    if (!orderId || !rating) {
      return res.status(400).json({ success: false, message: 'Order ID and rating are required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Prepare items reference from order details
    const orderedItems = order.items.map(item => ({
      name: item.name,
      quantity: item.quantity
    }));

    const newReview = new Review({
      cafeId: order.cafeId || 'CD001',
      orderId,
      customerName: order.customerName || 'Anonymous',
      rating,
      reviewText: reviewText || '',
      orderedItems
    });

    const savedReview = await newReview.save();
    return res.status(201).json({ success: true, data: savedReview });
  } catch (error) {
    console.error('Error creating review:', error);
    return res.status(500).json({ success: false, message: 'Server error while submitting review', error: error.message });
  }
};

// @desc    Get all reviews with filtering and summary
// @route   GET /api/reviews
// @access  Private (Owner/Manager dashboard)
const getReviews = async (req, res) => {
  try {
    const cafeId = req.user.cafeId;
    const { rating } = req.query;

    if (!cafeId) {
      return res.status(400).json({ success: false, message: 'No cafe associated with user session' });
    }

    const query = { cafeId };
    if (rating) {
      query.rating = Number(rating);
    }

    const reviews = await Review.find(query).sort({ createdAt: -1 });

    // Calculate ratings summary
    const allReviewsForSummary = await Review.find({ cafeId });
    const totalCount = allReviewsForSummary.length;
    let sum = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    allReviewsForSummary.forEach(r => {
      sum += r.rating;
      if (distribution[r.rating] !== undefined) {
        distribution[r.rating] += 1;
      }
    });

    const averageRating = totalCount > 0 ? Number((sum / totalCount).toFixed(1)) : 0;

    return res.status(200).json({
      success: true,
      data: reviews,
      summary: {
        totalReviews: totalCount,
        averageRating,
        distribution
      }
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching reviews', error: error.message });
  }
};

module.exports = {
  createReview,
  getReviews
};
