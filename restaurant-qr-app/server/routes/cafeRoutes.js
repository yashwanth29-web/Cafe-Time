const express = require('express');
const router = express.Router();
const Cafe = require('../models/Cafe');
const User = require('../models/User');

router.get('/:id', async (req, res) => {
  try {
    const hasOwnerIdField = Cafe.schema.paths.ownerId !== undefined;
    let cafe;
    
    if (hasOwnerIdField) {
      cafe = await Cafe.findOne({ cafeId: req.params.id }).populate('ownerId', 'name email');
    } else {
      cafe = await Cafe.findOne({ cafeId: req.params.id });
    }

    if (!cafe) {
      // Return default info so we don't break if CD001 doesn't exist yet
      return res.status(200).json({
        success: true,
        data: {
          cafeId: req.params.id,
          name: 'Dr. Chai Cafe',
          logoUrl: '',
          ownerName: 'Kamala Bevara', // Fallback owner name
          address: 'Main Road, Near Metro Station, Hyderabad',
          gstNumber: '36AAAAA1111A1Z1',
          supportNumber: '+91 9876543210'
        }
      });
    }

    let ownerName = 'Kamala Bevara'; // Fallback owner name
    if (hasOwnerIdField && cafe.ownerId) {
      ownerName = cafe.ownerId.name || ownerName;
    } else if (cafe.ownerEmail) {
      const owner = await User.findOne({ email: cafe.ownerEmail, role: { $in: ['admin', 'owner', 'ADMIN', 'OWNER'] } }).lean();
      if (owner) {
        ownerName = owner.name;
      }
    }

    const cafeData = {
      ...cafe.toObject(),
      ownerName
    };

    return res.status(200).json({ success: true, data: cafeData });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching cafe details', error: error.message });
  }
});

module.exports = router;
