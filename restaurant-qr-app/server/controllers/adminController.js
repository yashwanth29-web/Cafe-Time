const User = require('../models/User');
const Cafe = require('../models/Cafe');
const PaymentConfig = require('../models/PaymentConfig');
const OperationalConfig = require('../models/OperationalConfig');
const Branch = require('../models/Branch');
const Order = require('../models/Order');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');
const Inventory = require('../models/Inventory');
const InventoryLog = require('../models/InventoryLog');
const emailService = require('../services/emailService');
const { encrypt, decrypt } = require('../utils/encryption');
const Razorpay = require('razorpay');

const parseCoordinates = (input) => {
  if (!input) return null;
  const str = String(input).trim();
  const qMatch = str.match(/[?&](?:q|query)=([\d.-]+)\s*,\s*([\d.-]+)/i);
  if (qMatch) return { latitude: parseFloat(qMatch[1]), longitude: parseFloat(qMatch[2]) };
  const atMatch = str.match(/@([\d.-]+)\s*,\s*([\d.-]+)/);
  if (atMatch) return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) };
  const placeMatch = str.match(/\/place\/([\d.-]+)\s*,\s*([\d.-]+)/i);
  if (placeMatch) return { latitude: parseFloat(placeMatch[1]), longitude: parseFloat(placeMatch[2]) };
  const simpleMatch = str.match(/^([\d.-]+)\s*,\s*([\d.-]+)$/);
  if (simpleMatch) return { latitude: parseFloat(simpleMatch[1]), longitude: parseFloat(simpleMatch[2]) };
  const generalMatch = str.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (generalMatch) return { latitude: parseFloat(generalMatch[1]), longitude: parseFloat(generalMatch[2]) };
  return null;
};
const parseCoords = (locationStr) => {
  const coords = parseCoordinates(locationStr);
  return coords ? { lat: coords.latitude, lng: coords.longitude } : { lat: 0, lng: 0 };
};

/**
 * Register a new Staff member bound to the Owner's cafe
 */
const createStaff = async (req, res) => {
  const { 
    name, email, phone, staffRole, assignedBranch, isActive,
    salaryType, dailyRate, hourlyRate, weeklyRate, monthlyRate, weeklyOff, joiningDate, salaryStatus
  } = req.body;
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

    if (assignedBranch) {
      const branchExists = await Branch.findOne({ branchId: assignedBranch, cafeId });
      if (!branchExists) {
        return res.status(400).json({
          success: false,
          message: `The assigned branch "${assignedBranch}" does not exist or does not belong to your cafe.`
        });
      }
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
      assignedBranch: assignedBranch || req.branchId || 'default',
      cafeId,
      isActive: isActive !== undefined ? isActive : true,
      salaryType: salaryType || 'DAILY',
      dailyRate: dailyRate !== undefined ? Number(dailyRate) : 0,
      hourlyRate: hourlyRate !== undefined ? Number(hourlyRate) : 0,
      weeklyRate: weeklyRate !== undefined ? Number(weeklyRate) : 0,
      monthlyRate: monthlyRate !== undefined ? Number(monthlyRate) : 0,
      weeklyOff: weeklyOff || 'Sunday',
      joiningDate: joiningDate ? new Date(joiningDate) : new Date(),
      salaryStatus: salaryStatus || 'ACTIVE'
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
    } else {
      query.assignedBranch = req.branchId || 'default';
    }

    const staff = await User.find(query).select('-password').sort({ createdAt: -1 }).lean();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const Attendance = require('../models/Attendance');
    const attendancesThisWeek = await Attendance.find({
      cafeId,
      createdAt: { $gte: monday }
    }).lean();

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const staffWithOrders = await Promise.all(staff.map(async (s) => {
      const ordersCount = await Order.countDocuments({
        cafeId,
        staffId: s._id,
        source: 'STAFF',
        createdAt: { $gte: todayStart }
      });
      
      const sAttendances = attendancesThisWeek.filter(a => a.staffId.toString() === s._id.toString());
      const weeklyBreakdown = {
        'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0, 'Sunday': 0
      };
      let currentWeekSalary = 0;

      sAttendances.forEach(att => {
        const attDate = new Date(att.date || att.createdAt);
        const dayName = dayNames[attDate.getDay()];
        
        let durationMin = att.totalDuration || 0;
        if (!att.checkOutTime && att.checkInTime) {
          durationMin = Math.max(0, Math.floor((Date.now() - new Date(att.checkInTime).getTime()) / 60000));
        }

        const overtimeHours = att.overtimeHours || 0;
        let earnings = 0;
        const sType = s.salaryType || 'DAILY';

        if (sType === 'DAILY') {
          if (durationMin >= 480) { earnings = s.dailyRate || 0; }
          else if (durationMin >= 240) { earnings = (s.dailyRate || 0) * 0.5; }
          const otRate = s.hourlyRate || ((s.dailyRate || 0) / 8);
          earnings += overtimeHours * otRate;
        } else if (sType === 'HOURLY') {
          earnings = (durationMin / 60) * (s.hourlyRate || 0) + (overtimeHours * (s.hourlyRate || 0));
        } else if (sType === 'WEEKLY') {
          earnings = (s.weeklyRate || 0) / 6;
          const otRate = s.hourlyRate || ((s.weeklyRate || 0) / 40);
          earnings += overtimeHours * otRate;
        } else if (sType === 'MONTHLY') {
          earnings = (s.monthlyRate || 0) / 26;
          const otRate = s.hourlyRate || ((s.monthlyRate || 0) / 160);
          earnings += overtimeHours * otRate;
        }

        earnings = Number(earnings.toFixed(2));
        weeklyBreakdown[dayName] = earnings;
        currentWeekSalary += earnings;
      });

      return {
        ...s,
        ordersHandledToday: ordersCount,
        weeklyBreakdown,
        currentWeekSalary: Number(currentWeekSalary.toFixed(2))
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
  const { 
    name, email, phone, staffRole, assignedBranch, isActive,
    salaryType, dailyRate, hourlyRate, weeklyRate, monthlyRate, weeklyOff, joiningDate, salaryStatus
  } = req.body;
  const cafeId = req.user.cafeId;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const staffMember = await User.findOne({ _id: id, cafeId });
    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found or does not belong to your cafe' });
    }

    if (assignedBranch !== undefined) {
      const branchExists = await Branch.findOne({ branchId: assignedBranch, cafeId });
      if (!branchExists) {
        return res.status(400).json({
          success: false,
          message: `The assigned branch "${assignedBranch}" does not exist or does not belong to your cafe.`
        });
      }
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
    if (salaryType) staffMember.salaryType = salaryType;
    if (dailyRate !== undefined) staffMember.dailyRate = Number(dailyRate);
    if (hourlyRate !== undefined) staffMember.hourlyRate = Number(hourlyRate);
    if (weeklyRate !== undefined) staffMember.weeklyRate = Number(weeklyRate);
    if (monthlyRate !== undefined) staffMember.monthlyRate = Number(monthlyRate);
    if (weeklyOff) staffMember.weeklyOff = weeklyOff;
    if (joiningDate) staffMember.joiningDate = new Date(joiningDate);
    if (salaryStatus) staffMember.salaryStatus = salaryStatus;

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
    const staffMember = await User.findOne({ _id: id, cafeId });
    if (!staffMember) {
      return res.status(404).json({ success: false, message: 'Staff member not found or does not belong to your cafe' });
    }



    await User.deleteOne({ _id: id });

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
  return res.status(200).json({
    success: true,
    message: 'UPI Payment mode active. Razorpay connection bypassed.'
  });
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

    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';
    const paymentConfig = await PaymentConfig.findOne({ cafeId, branchId: activeBranch });
    const operationalConfig = await OperationalConfig.findOne({ cafeId, branchId: activeBranch });

    return res.status(200).json({
      success: true,
      cafe,
      paymentConfig: paymentConfig ? {
        acceptCash: paymentConfig.acceptCash,
        enableUpi: paymentConfig.enableUpi,
        upiId: paymentConfig.upiId,
        bankHolderName: paymentConfig.bankHolderName,
        accountNumber: paymentConfig.accountNumber,
        ifscCode: paymentConfig.ifscCode,
        taxRate: paymentConfig.taxRate,
        platformCharge: paymentConfig.platformCharge,
        paymentInstructions: paymentConfig.paymentInstructions
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
    logoUrl, address, mapsLocation, latitude, longitude, openingTime, closingTime, gstNumber, supportNumber, uiPrimaryColor,
    paymentConfig,
    operationalConfig,
    staffList,
    gstRate,
    taxRate,
    serviceChargeRate,
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

    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';

    if (name) cafe.name = name;
    if (businessType) cafe.businessType = businessType;
    if (branchCount !== undefined) cafe.branchCount = branchCount;
    if (city) cafe.city = city;
    if (state) cafe.state = state;
    if (pincode) cafe.pincode = pincode;
    if (logoUrl) cafe.logoUrl = logoUrl;
    if (address) cafe.address = address;
    let latVal = cafe.latitude || 0;
    let lngVal = cafe.longitude || 0;

    if (latitude !== undefined && latitude !== '') {
      latVal = Number(latitude);
    }
    if (longitude !== undefined && longitude !== '') {
      lngVal = Number(longitude);
    }

    if (mapsLocation) {
      cafe.mapsLocation = mapsLocation;
      const coords = parseCoordinates(mapsLocation);
      if (coords) {
        latVal = coords.latitude;
        lngVal = coords.longitude;
      }
    }

    cafe.latitude = latVal;
    cafe.longitude = lngVal;

    await Branch.findOneAndUpdate(
      { branchId: activeBranch, cafeId },
      {
        branchName: cafe.name || name || 'Primary Location',
        latitude: latVal,
        longitude: lngVal,
        address: cafe.address || address || 'Default Address',
        allowedRadius: 30,
        isActive: true
      },
      { upsert: true }
    );
    if (openingTime) cafe.openingTime = openingTime;
    if (closingTime) cafe.closingTime = closingTime;
    if (gstNumber) cafe.gstNumber = gstNumber;
    if (supportNumber) cafe.supportNumber = supportNumber;
    if (uiPrimaryColor) cafe.uiPrimaryColor = uiPrimaryColor;
    const finalGst = gstRate !== undefined ? gstRate : taxRate;
    const finalSc = serviceChargeRate !== undefined ? serviceChargeRate : serviceCharge;
    if (finalGst !== undefined) cafe.gstRate = Number(finalGst);
    if (finalSc !== undefined) cafe.serviceChargeRate = Number(finalSc);
    cafe.setupCompleted = true; // Complete setup flag!
    await cafe.save();

    // 2. Save PaymentConfig
    if (paymentConfig) {
      const updateData = {
        acceptCash: paymentConfig.acceptCash !== undefined ? paymentConfig.acceptCash : true,
        enableUpi: paymentConfig.enableUpi !== undefined ? paymentConfig.enableUpi : true,
        upiId: (paymentConfig.upiId || '').trim(),
        bankHolderName: (paymentConfig.bankHolderName || '').trim(),
        accountNumber: (paymentConfig.accountNumber || '').trim(),
        ifscCode: (paymentConfig.ifscCode || '').trim(),
        taxRate: paymentConfig.taxRate !== undefined ? Number(paymentConfig.taxRate) : 0,
        platformCharge: paymentConfig.platformCharge !== undefined ? Number(paymentConfig.platformCharge) : 0,
        paymentInstructions: (paymentConfig.paymentInstructions || '').trim()
      };

      await PaymentConfig.findOneAndUpdate(
        { cafeId, branchId: activeBranch },
        updateData,
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 3. Save OperationalConfig
    if (operationalConfig) {
      await OperationalConfig.findOneAndUpdate(
        { cafeId, branchId: activeBranch },
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
    const role = (req.user.role || '').toLowerCase();
    const query = { cafeId };
    if (['manager', 'chef', 'waiter', 'cashier', 'staff'].includes(role)) {
      query.branchId = req.user.assignedBranch || 'default';
    }
    const branches = await Branch.find(query).sort({ createdAt: -1 });
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
  const { branchName, address, manager, isActive, latitude, longitude, allowedRadius, city, state, pincode, googleMapsUrl, openingTime, closingTime } = req.body;
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
      latitude: (() => {
        const latStr = String(latitude || '');
        const lngStr = String(longitude || '');
        if (latStr.includes('http') || latStr.includes('maps')) {
          const coords = parseCoordinates(latStr);
          return coords ? coords.latitude : 0;
        }
        return latitude !== undefined && latitude !== '' ? Number(latitude) : 0;
      })(),
      longitude: (() => {
        const latStr = String(latitude || '');
        const lngStr = String(longitude || '');
        if (latStr.includes('http') || latStr.includes('maps')) {
          const coords = parseCoordinates(latStr);
          return coords ? coords.longitude : 0;
        }
        return longitude !== undefined && longitude !== '' ? Number(longitude) : 0;
      })(),
      allowedRadius: allowedRadius !== undefined ? Number(allowedRadius) : 100,
      city: (city || '').trim(),
      state: (state || '').trim(),
      pincode: (pincode || '').trim(),
      googleMapsUrl: (googleMapsUrl || '').trim(),
      openingTime: (openingTime || '09:00 AM').trim(),
      closingTime: (closingTime || '10:00 PM').trim(),
      isActive: isActive !== undefined ? isActive : true,
      unifiedStaffMode: req.body.unifiedStaffMode !== undefined ? !!req.body.unifiedStaffMode : false
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
  const activeBranchId = req.branchId || 'default';
  try {
    const staffMembers = await User.find({
      cafeId,
      assignedBranch: activeBranchId,
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

  // Sync to GridFS
  try {
    const { syncToGridFS } = require('../utils/gridfs');
    await syncToGridFS(req.file);
  } catch (err) {
    console.error('Error syncing logo to GridFS:', err);
  }
  const logoUrl = `/uploads/${req.file.filename}`;

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
  const { branchName, address, manager, isActive, latitude, longitude, allowedRadius, city, state, pincode, googleMapsUrl, openingTime, closingTime } = req.body;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const branch = await Branch.findOne({ _id: id, cafeId });
    if (!branch) {
      return res.status(404).json({ success: false, message: 'Branch not found or does not belong to your cafe' });
    }

    if (branchName !== undefined) {
      const trimmed = (branchName || '').trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Branch Name cannot be empty' });
      }
      branch.branchName = trimmed;
    }
    if (address !== undefined) {
      const trimmed = (address || '').trim();
      if (!trimmed) {
        return res.status(400).json({ success: false, message: 'Address cannot be empty' });
      }
      branch.address = trimmed;
    }
    if (manager !== undefined) {
      branch.manager = (manager || '').trim();
    }
    
    if (latitude !== undefined || longitude !== undefined) {
      let latVal = latitude !== undefined && latitude !== '' ? Number(latitude) : branch.latitude;
      let lngVal = longitude !== undefined && longitude !== '' ? Number(longitude) : branch.longitude;
      
      const latStr = String(latitude || '');
      const lngStr = String(longitude || '');
      if (latStr.includes('http') || latStr.includes('maps')) {
        const coords = parseCoordinates(latStr);
        if (coords) {
          latVal = coords.latitude;
          lngVal = coords.longitude;
        }
      } else if (lngStr.includes('http') || lngStr.includes('maps')) {
        const coords = parseCoordinates(lngStr);
        if (coords) {
          latVal = coords.latitude;
          lngVal = coords.longitude;
        }
      }
      
      branch.latitude = latVal;
      branch.longitude = lngVal;
    }
    if (allowedRadius !== undefined) branch.allowedRadius = Number(allowedRadius);
    if (isActive !== undefined) branch.isActive = isActive;
    if (city !== undefined) branch.city = city.trim();
    if (state !== undefined) branch.state = state.trim();
    if (pincode !== undefined) branch.pincode = pincode.trim();
    if (googleMapsUrl !== undefined) branch.googleMapsUrl = googleMapsUrl.trim();
    if (openingTime !== undefined) branch.openingTime = openingTime.trim();
    if (closingTime !== undefined) branch.closingTime = closingTime.trim();
    if (req.body.unifiedStaffMode !== undefined) branch.unifiedStaffMode = !!req.body.unifiedStaffMode;

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
 * Get storage health details
 */
const getStorageHealth = async (req, res) => {
  try {
    const { getStorageHealthData } = require('../services/storageCleanupService');
    const healthData = await getStorageHealthData();
    return res.status(200).json(healthData);
  } catch (error) {
    console.error('getStorageHealth error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving storage health stats' });
  }
};
const updateCafeTheme = async (req, res) => {
  const { uiPrimaryColor } = req.body;
  const cafeId = req.user.cafeId;
  if (!cafeId) return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  try {
    const cafe = await Cafe.findOne({ cafeId });
    if (!cafe) return res.status(404).json({ success: false, message: 'Cafe not found' });
    if (uiPrimaryColor) cafe.uiPrimaryColor = uiPrimaryColor;
    await cafe.save();
    return res.status(200).json({ success: true, message: 'Theme color updated successfully', cafe });
  } catch (error) {
    console.error('updateCafeTheme error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating theme' });
  }
};

/**
 * Generate POS/ERP reports dynamically
 */
const getReports = async (req, res) => {
  const cafeId = req.user.cafeId;
  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  const { type, branchId, startDate, endDate } = req.query;
  if (!type) {
    return res.status(400).json({ success: false, message: 'Report type is required' });
  }

  try {
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter = { $gte: start, $lte: end };
    }

    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user?.role || '').toLowerCase());
    const finalBranchId = isStaff ? req.user.assignedBranch : (branchId === 'all' ? null : branchId);

    const orderQuery = { cafeId };
    if (finalBranchId) orderQuery.branchId = finalBranchId;
    if (startDate && endDate) orderQuery.createdAt = dateFilter;

    const logQuery = { cafeId };
    if (finalBranchId) logQuery.branchId = finalBranchId;
    if (startDate && endDate) logQuery.createdAt = dateFilter;

    const inventoryQuery = { cafeId };
    if (finalBranchId) inventoryQuery.branchId = finalBranchId;

    const attendanceQuery = { cafeId };
    if (finalBranchId) attendanceQuery.branchId = finalBranchId;
    if (startDate && endDate) attendanceQuery.date = { $gte: startDate, $lte: endDate };

    const payrollQuery = { cafeId };
    if (finalBranchId) payrollQuery.branchId = finalBranchId;

    let reportData = [];

    switch (type) {
      case 'revenue': {
        const query = { ...orderQuery, paymentStatus: 'Paid' };
        const orders = await Order.find(query).sort({ createdAt: -1 }).lean();
        reportData = orders.map(o => ({
          orderId: o._id.toString(),
          invoiceNumber: o.invoiceNumber || o.orderNumber || o._id.toString().slice(-6).toUpperCase(),
          date: o.createdAt,
          branch: o.branchId || 'default',
          paymentMethod: o.paymentMethod || 'UPI',
          paymentStatus: o.paymentStatus,
          subtotal: (o.totalAmount || 0) - (o.gstAmount || 0) - (o.serviceCharge || 0) + (o.discount || 0),
          discount: o.discount || 0,
          tax: o.gstAmount || 0,
          netRevenue: (o.totalAmount || 0) - (o.gstAmount || 0),
          grandTotal: o.totalAmount || 0
        }));
        break;
      }

      case 'orders': {
        const orders = await Order.find(orderQuery).sort({ createdAt: -1 }).lean();
        reportData = orders.map(o => ({
          orderId: o._id.toString(),
          customer: o.customerName || 'Anonymous',
          table: o.tableNumber || 'N/A',
          items: (o.items || []).map(i => `${i.name} x${i.quantity}`).join(', '),
          quantity: (o.items || []).reduce((sum, i) => sum + (i.quantity || 0), 0),
          status: o.status || 'Pending',
          createdTime: o.createdAt,
          completedTime: o.updatedAt || o.createdAt,
          paymentStatus: o.paymentStatus || 'Pending',
          grandTotal: o.totalAmount || 0
        }));
        break;
      }

      case 'inventory': {
        const items = await Inventory.find(inventoryQuery).sort({ name: 1 }).lean();
        reportData = items.map(item => ({
          ingredient: item.name,
          category: item.category || 'General',
          currentStock: item.quantity || 0,
          minimumStock: item.minStock || 0,
          maximumStock: item.maxStock || 'N/A',
          unit: item.unit || 'units',
          unitCost: item.cost || 0,
          inventoryValue: (item.quantity || 0) * (item.cost || 0),
          supplier: item.supplier || 'N/A'
        }));
        break;
      }

      case 'inventory_consumption': {
        const query = { ...logQuery, type: { $in: ['Deduction', 'Wastage', 'Damaged', 'Shortage'] } };
        const logs = await InventoryLog.find(query).sort({ createdAt: -1 }).lean();
        const grouped = {};
        for (const log of logs) {
          const name = log.itemName;
          if (!grouped[name]) {
            grouped[name] = {
              ingredient: name,
              consumedQuantity: 0,
              consumedCost: 0,
              logCount: 0
            };
          }
          const qty = Math.abs(log.quantityChanged || 0);
          grouped[name].consumedQuantity += qty;
          grouped[name].consumedCost += log.cost || 0;
          grouped[name].logCount += 1;
        }
        reportData = Object.values(grouped);
        break;
      }

      case 'purchases': {
        const query = { ...logQuery, type: 'Purchase' };
        const logs = await InventoryLog.find(query).sort({ createdAt: -1 }).lean();
        reportData = logs.map(log => ({
          supplier: log.reason || 'N/A',
          purchaseDate: log.createdAt,
          ingredient: log.itemName,
          quantity: log.quantityChanged || 0,
          unitCost: (log.quantityChanged || 0) > 0 ? (log.cost || 0) / log.quantityChanged : 0,
          totalCost: log.cost || 0
        }));
        break;
      }

      case 'attendance': {
        const records = await Attendance.find(attendanceQuery).sort({ date: -1 }).lean();
        const grouped = {};
        for (const r of records) {
          const key = r.userEmail || r.userId?.toString() || 'Unknown';
          if (!grouped[key]) {
            grouped[key] = {
              employee: r.userName || r.userEmail || 'Staff Member',
              present: 0,
              absent: 0,
              late: 0,
              workingHours: 0,
              overtime: 0
            };
          }
          if (r.status === 'Present') {
            grouped[key].present += 1;
          } else if (r.status === 'Absent') {
            grouped[key].absent += 1;
          }
          if (r.isLate) {
            grouped[key].late += 1;
          }
          grouped[key].workingHours += r.workingHours || 0;
          grouped[key].overtime += r.overtime || 0;
        }
        reportData = Object.values(grouped);
        break;
      }

      case 'payroll': {
        const payrolls = await Payroll.find(payrollQuery).sort({ createdAt: -1 }).lean();
        reportData = payrolls.map(p => ({
          employee: p.userName || 'Employee',
          role: p.userRole || 'Staff',
          workingDays: p.workingDays || 0,
          actualHours: p.workingHours || 0,
          requiredHours: p.requiredHours || 0,
          dailyWage: p.dailyWage || 0,
          calculatedSalary: p.salary || 0,
          weeklySalary: (p.salary || 0) / 4,
          monthlySalary: p.salary || 0
        }));
        break;
      }

      case 'top_selling': {
        const query = { ...orderQuery, paymentStatus: 'Paid' };
        const orders = await Order.find(query).lean();
        const selling = {};
        for (const o of orders) {
          for (const item of o.items || []) {
            const name = item.name;
            if (!selling[name]) {
              selling[name] = {
                menuItem: name,
                quantitySold: 0,
                revenue: 0,
                avgDailySales: 0
              };
            }
            selling[name].quantitySold += item.quantity || 0;
            selling[name].revenue += (item.price || 0) * (item.quantity || 0);
          }
        }
        reportData = Object.values(selling).sort((a, b) => b.quantitySold - a.quantitySold);
        break;
      }

      case 'low_stock': {
        const items = await Inventory.find(inventoryQuery).lean();
        const lowStockItems = items.filter(item => (item.quantity || 0) <= (item.minStock || 0));
        reportData = lowStockItems.map(item => ({
          ingredient: item.name,
          currentStock: item.quantity || 0,
          minimumStock: item.minStock || 0,
          estimatedRemainingDays: (item.quantity || 0) > 0 ? Math.ceil((item.quantity || 0) / 5) : 0
        }));
        break;
      }

      case 'payment': {
        const query = { ...orderQuery, paymentStatus: 'Paid' };
        const orders = await Order.find(query).lean();
        const payments = {};
        for (const o of orders) {
          const method = o.paymentMethod || 'UPI';
          if (!payments[method]) {
            payments[method] = {
              paymentMethod: method,
              orderCount: 0,
              netRevenue: 0,
              tax: 0,
              grandTotal: 0
            };
          }
          payments[method].orderCount += 1;
          payments[method].netRevenue += (o.totalAmount || 0) - (o.gstAmount || 0);
          payments[method].tax += o.gstAmount || 0;
          payments[method].grandTotal += o.totalAmount || 0;
        }
        reportData = Object.values(payments);
        break;
      }

      case 'profit_summary': {
        const queryOrders = { ...orderQuery, paymentStatus: 'Paid' };
        const orders = await Order.find(queryOrders).lean();
        const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

        const ingredients = await Inventory.find(inventoryQuery).lean();
        const inventoryValue = ingredients.reduce((sum, item) => sum + (item.quantity || 0) * (item.cost || 0), 0);

        const queryDeductions = { ...logQuery, type: { $in: ['Deduction', 'Wastage', 'Damaged', 'Shortage'] } };
        const logsDeduction = await InventoryLog.find(queryDeductions).lean();
        const inventoryConsumption = logsDeduction.reduce((sum, log) => sum + (log.cost || 0), 0);

        const queryPurchases = { ...logQuery, type: 'Purchase' };
        const logsPurchases = await InventoryLog.find(queryPurchases).lean();
        const purchaseCost = logsPurchases.reduce((sum, log) => sum + (log.cost || 0), 0);

        const grossProfit = totalRevenue - inventoryConsumption;
        const netProfit = grossProfit;

        reportData = [{
          revenue: totalRevenue,
          inventoryCost: inventoryValue,
          inventoryConsumption,
          purchaseCost,
          grossProfit,
          netProfit
        }];
        break;
      }

      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    return res.status(200).json({ success: true, type, count: reportData.length, data: reportData });
  } catch (error) {
    console.error('getReports error:', error);
    return res.status(500).json({ success: false, message: 'Server error generating report data', error: error.message });
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
  getStorageHealth,
  updateCafeTheme,
  getReports
};
