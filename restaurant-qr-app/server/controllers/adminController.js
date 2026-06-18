const User = require('../models/User');
const Cafe = require('../models/Cafe');
const PaymentConfig = require('../models/PaymentConfig');
const OperationalConfig = require('../models/OperationalConfig');
const Branch = require('../models/Branch');
const Order = require('../models/Order');
const emailService = require('../services/emailService');
const { encrypt, decrypt } = require('../utils/encryption');
const Razorpay = require('razorpay');

/**
 * Register a new Staff member bound to the Owner's cafe
 */
const createStaff = async (req, res) => {
  const { name, email, phone, staffRole, assignedBranch, isActive } = req.body;
  const cafeId = req.user.cafeId;

  if (!name || !phone || !staffRole) {
    return res.status(400).json({ success: false, message: 'Name, Phone, and Role are required' });
  }

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    let cleanEmail = undefined;
    if (email && email.trim() !== '') {
      cleanEmail = email.trim().toLowerCase();
      const existingUser = await User.findOne({ email: cleanEmail });
      if (existingUser) {
        return res.status(400).json({ 
          success: false, 
          message: `An account with email ${email} is already registered.` 
        });
      }
    }

    const cafe = await Cafe.findOne({ cafeId });
    const cafeName = cafe ? cafe.name : 'Your Cafe';

    // Staff accounts can have a role of 'staff', and custom roles like 'chef', 'manager', 'waiter', or 'cashier'
    let targetRole = 'staff';
    const sRoleLower = staffRole.toLowerCase();
    if (['manager', 'chef', 'waiter', 'cashier'].includes(sRoleLower)) {
      targetRole = sRoleLower;
    }

    // Auto-generate unique Employee ID
    let employeeId;
    let exists = true;
    while (exists) {
      employeeId = `EMP-${Math.floor(100000 + Math.random() * 900000)}`;
      const existingEmp = await User.findOne({ employeeId });
      if (!existingEmp) exists = false;
    }

    const newStaff = await User.create({
      name: name.trim(),
      email: cleanEmail || undefined,
      phone: phone.trim(),
      role: targetRole,
      staffRole: staffRole.trim(),
      employeeId,
      assignedBranch: assignedBranch || '',
      cafeId,
      isActive: isActive !== undefined ? isActive : true
    });

    if (cleanEmail) {
      emailService.sendWelcomeEmail(cleanEmail, name, targetRole, {
        cafeName,
        cafeId,
        staffRole
      });
    }

    return res.status(201).json({
      success: true,
      message: `Staff member "${name}" registered successfully with Employee ID "${employeeId}".`,
      staff: newStaff
    });
  } catch (error) {
    console.error('createStaff error:', error);
    return res.status(500).json({ success: false, message: 'Server error registering staff member' });
  }
};

/**
 * Get all staff members for the owner's cafe
 */
const getStaff = async (req, res) => {
  const cafeId = req.user.cafeId;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const query = { 
      cafeId, 
      role: { $in: ['staff', 'chef', 'manager', 'waiter', 'cashier', 'STAFF', 'CHEF', 'MANAGER', 'WAITER', 'CASHIER'] } 
    };

    if (req.user.role === 'manager') {
      if (req.user.assignedBranch) {
        query.assignedBranch = req.user.assignedBranch;
      }
      query._id = { $ne: req.user._id };
    }

    const staff = await User.find(query).sort({ createdAt: -1 });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const staffWithOrders = await Promise.all(staff.map(async (s) => {
      const ordersCount = await Order.countDocuments({
        cafeId,
        staffId: s._id,
        source: 'STAFF',
        createdAt: { $gte: todayStart }
      });
      
      return {
        ...s.toObject(),
        ordersHandledToday: ordersCount
      };
    }));
    
    return res.status(200).json({ success: true, staff: staffWithOrders });
  } catch (error) {
    console.error('getStaff error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving staff list' });
  }
};

/**
 * Update an existing Staff member details
 */
const updateStaff = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, staffRole, assignedBranch, isActive } = req.body;
  const cafeId = req.user.cafeId;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const staffMember = await User.findOne({ _id: id, cafeId });
    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found or does not belong to your cafe' });
    }

    if (name) staffMember.name = name.trim();
    if (email !== undefined) {
      if (email && email.trim() !== '') {
        const cleanEmail = email.trim().toLowerCase();
        // Check if email is already taken by another user
        const existingUser = await User.findOne({ email: cleanEmail, _id: { $ne: id } });
        if (existingUser) {
          return res.status(400).json({ success: false, message: `An account with email ${email} is already registered.` });
        }
        staffMember.email = cleanEmail;
      } else {
        staffMember.email = undefined;
      }
    }
    if (phone) staffMember.phone = phone.trim();
    if (staffRole) {
      staffMember.staffRole = staffRole.trim();
      let targetRole = 'staff';
      const sRoleLower = staffRole.toLowerCase();
      if (['manager', 'chef', 'waiter', 'cashier'].includes(sRoleLower)) {
        targetRole = sRoleLower;
      }
      staffMember.role = targetRole;
    }
    if (assignedBranch !== undefined) {
      staffMember.assignedBranch = assignedBranch;
    }
    if (isActive !== undefined) {
      staffMember.isActive = isActive;
    }

    await staffMember.save();

    return res.status(200).json({
      success: true,
      message: 'Staff member updated successfully.',
      staff: staffMember
    });
  } catch (error) {
    console.error('updateStaff error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating staff member' });
  }
};

/**
 * Delete a Staff member
 */
const deleteStaff = async (req, res) => {
  const { id } = req.params;
  const cafeId = req.user.cafeId;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const staffMember = await User.findOneAndDelete({ _id: id, cafeId });
    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found or does not belong to your cafe' });
    }

    return res.status(200).json({
      success: true,
      message: `Staff member "${staffMember.name}" deleted successfully.`
    });
  } catch (error) {
    console.error('deleteStaff error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting staff member' });
  }
};

/**
 * Test and verify Razorpay keys for a Cafe
 */
const verifyRazorpay = async (req, res) => {
  const { keyId, secret } = req.body;

  if (!keyId || !secret) {
    return res.status(400).json({ success: false, message: 'Key ID and Secret Key are required.' });
  }

  try {
    const rzp = new Razorpay({
      key_id: keyId,
      key_secret: secret
    });

    // Attempt to list orders (limit 1) to test if key/secret are valid
    await rzp.orders.all({ count: 1 });

    return res.status(200).json({
      success: true,
      message: 'Razorpay keys verified successfully.'
    });
  } catch (error) {
    console.error('verifyRazorpay error:', error);
    return res.status(400).json({
      success: false,
      message: `Razorpay verification failed: ${error.message || 'Check key and secret credentials'}`
    });
  }
};

/**
 * Retrieve Owner setup configuration data
 */
const getSetupData = async (req, res) => {
  const cafeId = req.user.cafeId;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const cafe = await Cafe.findOne({ cafeId });
    if (!cafe) {
      return res.status(404).json({ success: false, message: 'Cafe not found' });
    }

    const paymentConfig = await PaymentConfig.findOne({ cafeId });
    const operationalConfig = await OperationalConfig.findOne({ cafeId });

    // Decrypt Razorpay Secret for editing in wizard (if configured)
    let decryptedSecret = '';
    if (paymentConfig && paymentConfig.razorpaySecretEncrypted) {
      decryptedSecret = decrypt(paymentConfig.razorpaySecretEncrypted);
    }

    return res.status(200).json({
      success: true,
      cafe,
      paymentConfig: paymentConfig ? {
        razorpayKeyId: paymentConfig.razorpayKeyId,
        razorpaySecret: decryptedSecret,
        upiId: paymentConfig.upiId,
        bankHolderName: paymentConfig.bankHolderName,
        accountNumber: paymentConfig.accountNumber,
        ifscCode: paymentConfig.ifscCode,
        isVerified: paymentConfig.isVerified
      } : null,
      operationalConfig
    });
  } catch (error) {
    console.error('getSetupData error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving setup details' });
  }
};

/**
 * Save all Owner setup configuration data and complete setup
 */
const saveSetupData = async (req, res) => {
  const cafeId = req.user.cafeId;
  const {
    name, businessType, branchCount, city, state, pincode,
    logoUrl, address, mapsLocation, openingTime, closingTime, gstNumber, supportNumber, uiPrimaryColor,
    paymentConfig,
    operationalConfig,
    staffList,
    taxRate,
    serviceCharge
  } = req.body;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    // 1. Update Cafe profile details
    const cafe = await Cafe.findOne({ cafeId });
    if (!cafe) {
      return res.status(404).json({ success: false, message: 'Cafe not found' });
    }

    if (name) cafe.name = name;
    if (businessType) cafe.businessType = businessType;
    if (branchCount !== undefined) cafe.branchCount = branchCount;
    if (city) cafe.city = city;
    if (state) cafe.state = state;
    if (pincode) cafe.pincode = pincode;
    if (logoUrl) cafe.logoUrl = logoUrl;
    if (address) cafe.address = address;
    if (mapsLocation) cafe.mapsLocation = mapsLocation;
    if (openingTime) cafe.openingTime = openingTime;
    if (closingTime) cafe.closingTime = closingTime;
    if (gstNumber) cafe.gstNumber = gstNumber;
    if (supportNumber) cafe.supportNumber = supportNumber;
    if (uiPrimaryColor) cafe.uiPrimaryColor = uiPrimaryColor;
    if (taxRate !== undefined) cafe.gstRate = taxRate;
    if (serviceCharge !== undefined) cafe.serviceChargeRate = serviceCharge;
    cafe.setupCompleted = true; // Complete setup flag!
    await cafe.save();

    // 2. Save PaymentConfig (Encrypting the Razorpay Secret)
    if (paymentConfig) {
      const encryptedSecret = encrypt(paymentConfig.razorpaySecret);
      await PaymentConfig.findOneAndUpdate(
        { cafeId },
        {
          razorpayKeyId: paymentConfig.razorpayKeyId,
          razorpaySecretEncrypted: encryptedSecret,
          upiId: paymentConfig.upiId,
          bankHolderName: paymentConfig.bankHolderName,
          accountNumber: paymentConfig.accountNumber,
          ifscCode: paymentConfig.ifscCode,
          isVerified: paymentConfig.isVerified || false
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 3. Save OperationalConfig
    if (operationalConfig) {
      await OperationalConfig.findOneAndUpdate(
        { cafeId },
        {
          tables: operationalConfig.tables || [],
          printerEnabled: operationalConfig.printerEnabled || false,
          kitchenDisplayEnabled: operationalConfig.kitchenDisplayEnabled || false,
          inventoryEnabled: operationalConfig.inventoryEnabled || false
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 4. Create Staff list (if provided)
    if (staffList && Array.isArray(staffList)) {
      for (const staff of staffList) {
        if (staff.email && staff.name && staff.phone) {
          const cleanEmail = staff.email.trim().toLowerCase();
          const existingUser = await User.findOne({ email: cleanEmail });
          if (!existingUser) {
            // Determine targeted role from staffRole
            let targetRole = 'staff';
            const sRole = (staff.staffRole || '').trim().toLowerCase();
            if (['manager', 'chef', 'waiter', 'cashier'].includes(sRole)) {
              targetRole = sRole;
            }

            // Auto-generate unique Employee ID
            let employeeId;
            let exists = true;
            while (exists) {
              employeeId = `EMP-${Math.floor(100000 + Math.random() * 900000)}`;
              const existingEmp = await User.findOne({ employeeId });
              if (!existingEmp) exists = false;
            }

            await User.create({
              name: staff.name.trim(),
              email: cleanEmail,
              phone: staff.phone.trim(),
              role: targetRole,
              staffRole: staff.staffRole || 'staff',
              employeeId,
              assignedBranch: staff.assignedBranch || '',
              cafeId,
              isActive: true
            });

            emailService.sendWelcomeEmail(cleanEmail, staff.name.trim(), targetRole, {
              cafeName: cafe.name,
              cafeId,
              staffRole: staff.staffRole || 'staff'
            });
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Onboarding setup completed successfully!'
    });
  } catch (error) {
    console.error('saveSetupData error:', error);
    return res.status(500).json({ success: false, message: 'Server error saving setup details' });
  }
};

/**
 * Update Owner profile details (Name & Phone)
 */
const updateOwnerProfile = async (req, res) => {
  const { name, phone } = req.body;
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Owner user not found' });
    }
    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();
    await user.save();
    return res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('updateOwnerProfile error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating owner profile' });
  }
};

/**
 * Retrieve branch list for current cafe
 */
const getBranches = async (req, res) => {
  const cafeId = req.user.cafeId;
  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }
  try {
    const branches = await Branch.find({ cafeId }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, branches });
  } catch (error) {
    console.error('getBranches error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving branches' });
  }
};

/**
 * Add a new branch to the current cafe
 */
const createBranch = async (req, res) => {
  const cafeId = req.user.cafeId;
  const { branchName, address, manager, isActive, latitude, longitude, allowedRadius } = req.body;
  if (!branchName || !address) {
    return res.status(400).json({ success: false, message: 'Branch Name and Address are required' });
  }
  try {
    const branchId = `${cafeId}_BR_${Date.now()}`;
    const newBranch = await Branch.create({
      branchId,
      branchName: branchName.trim(),
      cafeId,
      address: address.trim(),
      manager: (manager || '').trim(),
      latitude: latitude !== undefined ? Number(latitude) : 0,
      longitude: longitude !== undefined ? Number(longitude) : 0,
      allowedRadius: allowedRadius !== undefined ? Number(allowedRadius) : 30,
      isActive: isActive !== undefined ? isActive : true
    });
    return res.status(201).json({ success: true, branch: newBranch });
  } catch (error) {
    console.error('createBranch error:', error);
    return res.status(500).json({ success: false, message: 'Server error creating branch' });
  }
};

/**
 * Get staff count analytics for Section 7
 */
const getStaffSummary = async (req, res) => {
  const cafeId = req.user.cafeId;
  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }
  try {
    const staffMembers = await User.find({
      cafeId,
      role: { $in: ['staff', 'chef', 'manager', 'waiter', 'cashier', 'STAFF', 'CHEF', 'MANAGER', 'WAITER', 'CASHIER'] }
    });

    const totalStaff = staffMembers.length;
    const activeStaff = staffMembers.filter(s => s.isActive).length;
    const managers = staffMembers.filter(s => (s.staffRole || '').toLowerCase() === 'manager' || (s.role || '').toLowerCase() === 'manager').length;
    const chefs = staffMembers.filter(s => (s.staffRole || '').toLowerCase() === 'chef' || (s.role || '').toLowerCase() === 'chef').length;
    const waiters = staffMembers.filter(s => (s.staffRole || '').toLowerCase() === 'waiter' || (s.role || '').toLowerCase() === 'waiter').length;
    const cashiers = staffMembers.filter(s => (s.staffRole || '').toLowerCase() === 'cashier' || (s.role || '').toLowerCase() === 'cashier').length;
    const standardStaff = totalStaff - managers - chefs - waiters - cashiers;

    return res.status(200).json({
      success: true,
      summary: {
        totalStaff,
        activeStaff,
        managers,
        chefs,
        waiters,
        cashiers,
        staffMembers: standardStaff
      }
    });
  } catch (error) {
    console.error('getStaffSummary error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving staff analytics' });
  }
};

/**
 * Handle Cafe logo image upload
 */
const uploadLogo = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No logo file uploaded' });
  }

  const protocol = req.protocol;
  const host = req.get('host');
  const logoUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

  return res.status(200).json({
    success: true,
    logoUrl
  });
};

/**
 * Update Branch details
 */
const updateBranch = async (req, res) => {
  const { id } = req.params;
  const cafeId = req.user.cafeId;
  const { branchName, address, manager, isActive, latitude, longitude, allowedRadius } = req.body;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const branch = await Branch.findOne({ _id: id, cafeId });
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found or does not belong to your cafe' });
    }

    if (branchName) branch.branchName = branchName.trim();
    if (address) branch.address = address.trim();
    if (manager !== undefined) branch.manager = manager.trim();
    if (latitude !== undefined) branch.latitude = Number(latitude);
    if (longitude !== undefined) branch.longitude = Number(longitude);
    if (allowedRadius !== undefined) branch.allowedRadius = Number(allowedRadius);
    if (isActive !== undefined) branch.isActive = isActive;

    await branch.save();

    return res.status(200).json({
      success: true,
      message: `Branch "${branch.branchName}" updated successfully.`,
      branch
    });
  } catch (error) {
    console.error('updateBranch error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating branch' });
  }
};

/**
 * Delete a Branch
 */
const deleteBranch = async (req, res) => {
  const { id } = req.params;
  const cafeId = req.user.cafeId;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const branch = await Branch.findOneAndDelete({ _id: id, cafeId });
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found or does not belong to your cafe' });
    }

    return res.status(200).json({
      success: true,
      message: `Branch "${branch.branchName}" deleted successfully.`
    });
  } catch (error) {
    console.error('deleteBranch error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting branch' });
  }
};

/**
 * Update Cafe UI Theme Color
 */
const updateCafeTheme = async (req, res) => {
  const { uiPrimaryColor } = req.body;
  const cafeId = req.user.cafeId;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const cafe = await Cafe.findOne({ cafeId });
    if (!cafe) {
      return res.status(404).json({ success: false, message: 'Cafe not found' });
    }

    if (uiPrimaryColor) cafe.uiPrimaryColor = uiPrimaryColor;
    await cafe.save();

    return res.status(200).json({
      success: true,
      message: 'Theme color updated successfully',
      cafe
    });
  } catch (error) {
    console.error('updateCafeTheme error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating theme' });
  }
};

module.exports = {
  createStaff,
  getStaff,
  updateStaff,
  deleteStaff,
  verifyRazorpay,
  getSetupData,
  saveSetupData,
  updateOwnerProfile,
  getBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  getStaffSummary,
  uploadLogo,
  updateCafeTheme
};
