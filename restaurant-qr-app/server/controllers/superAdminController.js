const User = require('../models/User');
const Cafe = require('../models/Cafe');
const SystemHealth = require('../models/SystemHealth');
const Branch = require('../models/Branch');
const emailService = require('../services/emailService');
const SupportTicket = require('../models/SupportTicket');

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
      const owner = await User.findOne({ email: cafe.ownerEmail, role: { $in: ['admin', 'owner', 'ADMIN', 'OWNER'] } });
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
  const { name, city, state, businessType, branchCount, isActive, subscriptionPlan, subscriptionStatus, subscriptionRenewal } = req.body;

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
    if (subscriptionPlan) cafe.subscriptionPlan = subscriptionPlan;
    if (subscriptionStatus) cafe.subscriptionStatus = subscriptionStatus;
    if (subscriptionRenewal) cafe.subscriptionRenewal = new Date(subscriptionRenewal);
    
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

/**
 * Get all support tickets. Auto-seeds defaults if the collection is empty.
 */
const getTickets = async (req, res) => {
  try {
    let tickets = await SupportTicket.find({}).sort({ createdAt: -1 });
    
    // Auto-seed some tickets if empty so the UI shows something nice
    if (tickets.length === 0) {
      const defaultTickets = [
        {
          ticketId: 'TKT-1001',
          cafeId: 'CAFE001',
          cafeName: 'Dr. Chai Cafe Main',
          subject: 'Printer configuration error',
          message: 'Thermal printer is not printing the QR receipt automatically when a new order is received.',
          status: 'Open',
          priority: 'High',
          createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        {
          ticketId: 'TKT-1002',
          cafeId: 'CAFE002',
          cafeName: 'Chai Point',
          subject: 'Menu upload limit',
          message: 'Can you please increase the menu upload limit for our basic plan?',
          status: 'Pending',
          priority: 'Medium',
          createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        {
          ticketId: 'TKT-1003',
          cafeId: 'CAFE001',
          cafeName: 'Dr. Chai Cafe Main',
          subject: 'Billing discrepancy',
          message: 'Our dashboard shows double charge for this month subscription.',
          status: 'Resolved',
          priority: 'High',
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        }
      ];
      await SupportTicket.insertMany(defaultTickets);
      tickets = await SupportTicket.find({}).sort({ createdAt: -1 });
    }

    return res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error('getTickets error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving support tickets' });
  }
};

/**
 * Update Support Ticket Status
 */
const updateTicketStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: 'Status is required' });
  }

  try {
    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Support ticket not found' });
    }

    ticket.status = status;
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: `Ticket status updated to ${status} successfully.`,
      ticket
    });
  } catch (error) {
    console.error('updateTicketStatus error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating ticket status' });
  }
};

module.exports = {
  createOwner,
  getCafes,
  updateCafe,
  deleteCafe,
  getTickets,
  updateTicketStatus
};
