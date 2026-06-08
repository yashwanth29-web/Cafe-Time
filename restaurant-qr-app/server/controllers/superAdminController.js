const User = require('../models/User');
const Cafe = require('../models/Cafe');
const SystemHealth = require('../models/SystemHealth');
const Branch = require('../models/Branch');
const emailService = require('../services/emailService');

/**
 * Create a new Cafe Owner and register the Cafe in the system (V2 Onboarding Registration)
 */
const createOwner = async (req, res) => {
  const { name, email, phone, cafeName, cafeId, city, state, branchCount, businessType } = req.body;

  if (!name || !email || !phone || !cafeName || !cafeId || !city || !state || !businessType) {
    return res.status(400).json({ success: false, message: 'All registration fields are required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCafeId = cafeId.trim().toUpperCase();

  try {
    // 1. Check if owner email is already taken
    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: `An account with email ${email} is already registered.` 
      });
    }

    // 2. Check if cafeId is already taken
    const existingCafe = await Cafe.findOne({ cafeId: cleanCafeId });
    if (existingCafe) {
      return res.status(400).json({ 
        success: false, 
        message: `Cafe ID "${cafeId}" is already taken.` 
      });
    }

    // 3. Create the Owner (admin role)
    const newOwner = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      role: 'admin',
      cafeId: cleanCafeId,
      isActive: true
    });

    // 4. Create the Cafe with V2 fields
    const newCafe = await Cafe.create({
      cafeId: cleanCafeId,
      name: cafeName.trim(),
      ownerEmail: cleanEmail,
      city: city.trim(),
      state: state.trim(),
      businessType: businessType,
      branchCount: branchCount ? Number(branchCount) : 1,
      setupCompleted: false,
      isActive: true
    });

    // 5. Initialize System Health tracker
    await SystemHealth.create({
      cafeId: cleanCafeId,
      lastHeartbeat: new Date(),
      frontendErrors: 0,
      backendErrors: 0,
      paymentFailures: 0,
      printerFailures: 0
    });

    // 6. Create default main Branch
    await Branch.create({
      branchId: `${cleanCafeId}-BR1`,
      branchName: `${cafeName.trim()} Main`,
      cafeId: cleanCafeId,
      address: `${city.trim()}, ${state.trim()}`,
      manager: name.trim(),
      isActive: true
    });

    // 7. Send Welcome email (async)
    emailService.sendWelcomeEmail(cleanEmail, name, 'admin', {
      cafeName: cafeName,
      cafeId: cleanCafeId
    });

    return res.status(201).json({
      success: true,
      message: 'Cafe Owner and Cafe registered successfully with default Branch and Health Monitor.',
      owner: newOwner,
      cafe: newCafe
    });
  } catch (error) {
    console.error('createOwner V2 error:', error);
    return res.status(500).json({ success: false, message: 'Server error registering owner and cafe' });
  }
};

/**
 * Get all cafes with owner details, branch details, and live system health
 */
const getCafes = async (req, res) => {
  try {
    const cafes = await Cafe.find({}).sort({ createdAt: -1 });
    
    // Fetch details for each cafe (Owner details, branch count, health log)
    const cafesWithDetails = await Promise.all(cafes.map(async (cafe) => {
      const owner = await User.findOne({ email: cafe.ownerEmail, role: 'admin' });
      const health = await SystemHealth.findOne({ cafeId: cafe.cafeId });
      const branches = await Branch.find({ cafeId: cafe.cafeId });

      return {
        ...cafe.toObject(),
        ownerName: owner ? owner.name : 'Unknown Owner',
        ownerPhone: owner ? owner.phone : 'N/A',
        ownerIsActive: owner ? owner.isActive : false,
        ownerLastLogin: owner ? owner.lastLogin : null,
        ownerLastSeen: owner ? owner.lastSeen : null,
        branchesCount: branches.length,
        branchesList: branches,
        health: health ? {
          lastHeartbeat: health.lastHeartbeat,
          frontendErrors: health.frontendErrors,
          backendErrors: health.backendErrors,
          paymentFailures: health.paymentFailures,
          printerFailures: health.printerFailures
        } : {
          lastHeartbeat: null,
          frontendErrors: 0,
          backendErrors: 0,
          paymentFailures: 0,
          printerFailures: 0
        }
      };
    }));

    return res.status(200).json({ success: true, cafes: cafesWithDetails });
  } catch (error) {
    console.error('getCafes error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching cafes' });
  }
};

/**
 * Update Cafe details, registration fields, or active status
 */
const updateCafe = async (req, res) => {
  const { id } = req.params;
  const { name, city, state, businessType, branchCount, isActive } = req.body;

  try {
    const cafe = await Cafe.findById(id);
    if (!cafe) {
      return res.status(404).json({ success: false, message: 'Cafe record not found' });
    }

    if (name) cafe.name = name.trim();
    if (city) cafe.city = city.trim();
    if (state) cafe.state = state.trim();
    if (businessType) cafe.businessType = businessType;
    if (typeof branchCount !== 'undefined') cafe.branchCount = Number(branchCount);
    
    if (typeof isActive !== 'undefined') {
      cafe.isActive = isActive;
      
      // Soft-deactivate/reactivate associated Owner and Staff users and Branches
      await User.updateMany(
        { cafeId: cafe.cafeId },
        { isActive: isActive }
      );
      
      await Branch.updateMany(
        { cafeId: cafe.cafeId },
        { isActive: isActive }
      );
    }

    await cafe.save();

    return res.status(200).json({ 
      success: true, 
      message: `Cafe details updated successfully.`,
      cafe 
    });
  } catch (error) {
    console.error('updateCafe error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating cafe details' });
  }
};

/**
 * Delete Cafe (Soft delete by setting isActive to false)
 */
const deleteCafe = async (req, res) => {
  const { id } = req.params;

  try {
    const cafe = await Cafe.findById(id);
    if (!cafe) {
      return res.status(404).json({ success: false, message: 'Cafe record not found' });
    }

    cafe.isActive = false;
    await cafe.save();

    // Set all associated owners, staff, and branches to inactive
    await User.updateMany(
      { cafeId: cafe.cafeId },
      { isActive: false }
    );

    await Branch.updateMany(
      { cafeId: cafe.cafeId },
      { isActive: false }
    );

    return res.status(200).json({ 
      success: true, 
      message: `Cafe "${cafe.name}" soft-deleted successfully.` 
    });
  } catch (error) {
    console.error('deleteCafe error:', error);
    return res.status(500).json({ success: false, message: 'Server error soft-deleting cafe' });
  }
};

module.exports = {
  createOwner,
  getCafes,
  updateCafe,
  deleteCafe
};
