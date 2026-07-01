const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');

// Protect all notification routes
router.use(protect);

/**
 * Get recent 10 notifications for the logged-in user
 * GET /api/notifications
 */
router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(15);
      
    return res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    console.error('Fetch notifications error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching notifications' });
  }
});

/**
 * Mark a notification as read
 * PATCH /api/notifications/:id/read
 */
router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    
    return res.status(200).json({ success: true, data: notification });
  } catch (error) {
    console.error('Read notification error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating notification status' });
  }
});

module.exports = router;
