const express = require('express');
const router = express.Router();
const Cafe = require('../models/Cafe');

router.get('/:id', async (req, res) => {
  try {
    const cafe = await Cafe.findOne({ cafeId: req.params.id });
    if (!cafe) {
      // Return default info so we don't break if CD001 doesn't exist yet
      return res.status(200).json({
        success: true,
        data: {
          cafeId: req.params.id,
          name: 'Dr. Chai Cafe',
          address: 'Main Road, Near Metro Station, Hyderabad',
          gstNumber: '36AAAAA1111A1Z1',
          supportNumber: '+91 9876543210'
        }
      });
    }
    return res.status(200).json({ success: true, data: cafe });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching cafe details', error: error.message });
  }
});

module.exports = router;
