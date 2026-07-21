const express = require('express');
const router = express.Router();
const Cafe = require('../models/Cafe');
const User = require('../models/User');

// Get payment config (UPI details) for branch/cafe (Accessible to staff)
router.get('/payment-info/config', async (req, res) => {
  try {
    const PaymentConfig = require('../models/PaymentConfig');
    // Ensure we have cafeId and branchId from middleware or query params
    const cafeId = req.cafeId || req.query.cafeId;
    const branchId = req.branchId || req.query.branchId || 'default';

    if (!cafeId) {
       return res.status(400).json({ success: false, message: 'Missing cafeId context' });
    }

    let config = await PaymentConfig.findOne({ cafeId, branchId });
    if (!config && branchId !== 'default') {
      config = await PaymentConfig.findOne({ cafeId, branchId: 'default' });
    }
    if (!config) {
      config = await PaymentConfig.findOne({ cafeId });
    }

    const Cafe = require('../models/Cafe');
    const cafeDoc = await Cafe.findOne({ cafeId }).lean();
    const defaultGst = cafeDoc?.gstRate || 0;
    const defaultPlatform = cafeDoc?.serviceChargeRate || 0;

    if (!config) {
      return res.status(200).json({ success: true, data: { enableUpi: false, upiId: '', taxRate: defaultGst, platformCharge: defaultPlatform } });
    }
    
    return res.status(200).json({ 
      success: true, 
      data: { 
        enableUpi: config.enableUpi, 
        upiId: config.upiId, 
        taxRate: config.taxRate || defaultGst, 
        platformCharge: config.platformCharge || defaultPlatform 
      } 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error fetching payment info', error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const hasOwnerIdField = Cafe.schema.paths.ownerId !== undefined;
    let cafe;
    
    if (hasOwnerIdField) {
      cafe = await Cafe.findOne({ cafeId: req.params.id }).populate('ownerId', 'name email');
    } else {
      cafe = await Cafe.findOne({ cafeId: req.params.id });
    }

    if (cafe && cafe.isDeleted) {
      return res.status(403).json({ success: false, message: 'This cafe has been deleted. Access denied.' });
    }

    if (!cafe) {
      // Return default info so we don't break if CD001 doesn't exist yet
      return res.status(200).json({
        success: true,
        data: {
          cafeId: req.params.id,
          name: 'Our Cafe',
          logoUrl: '',
          ownerName: 'Owner', // Fallback owner name
          address: '',
          gstNumber: '',
          supportNumber: ''
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

// POST /api/cafe/heartbeat
router.post('/heartbeat', async (req, res) => {
  const { cafeId, branchId, connectedUsers, activeStaff, activeOrders, kitchenStatus, inventorySyncStatus, services } = req.body;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Missing cafeId' });
  }

  try {
    const SystemHealth = require('../models/SystemHealth');
    const Branch = require('../models/Branch');

    // 1. Update Cafe System Health
    let health = await SystemHealth.findOne({ cafeId });
    if (!health) {
      health = new SystemHealth({ cafeId });
    }
    health.lastHeartbeat = new Date();
    if (typeof connectedUsers !== 'undefined') health.connectedUsers = Number(connectedUsers);
    if (typeof activeOrders !== 'undefined') health.activeOrders = Number(activeOrders);
    if (kitchenStatus) health.kitchenStatus = kitchenStatus;
    
    // Increment or track failure counts if provided in services
    if (services) {
      if (services.api === 'disconnected') health.backendErrors += 1;
      if (services.paymentGateway === 'disconnected') health.paymentFailures += 1;
      if (services.printer === 'disconnected') health.printerFailures += 1;
    }
    await health.save();

    // 2. Update Branch Health
    if (branchId) {
      const branch = await Branch.findOne({ branchId, cafeId });
      if (branch) {
        branch.lastHeartbeat = new Date();
        if (typeof activeStaff !== 'undefined') branch.activeStaff = Number(activeStaff);
        if (typeof activeOrders !== 'undefined') branch.activeOrders = Number(activeOrders);
        if (inventorySyncStatus) branch.inventorySyncStatus = inventorySyncStatus;
        if (services) {
          branch.services = services;
        }
        await branch.save();
      }
    }

    return res.status(200).json({ success: true, message: 'Heartbeat recorded successfully' });
  } catch (error) {
    console.error('Heartbeat logging error:', error);
    return res.status(500).json({ success: false, message: 'Server error recording heartbeat', error: error.message });
  }
});

module.exports = router;
