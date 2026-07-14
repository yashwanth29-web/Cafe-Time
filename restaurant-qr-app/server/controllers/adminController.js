const mongoose = require('mongoose');
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
    salaryType, dailyRate, requiredHours, hourlyRate, weeklyRate, monthlyRate, weeklyOff, joiningDate, salaryStatus
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
      requiredHours: requiredHours !== undefined ? Number(requiredHours) : 8,
      hourlyRate: dailyRate !== undefined ? Number((Number(dailyRate) / (requiredHours !== undefined ? Number(requiredHours) : 8)).toFixed(2)) : 0,
      weeklyRate: dailyRate !== undefined ? Number((Number(dailyRate) * 6).toFixed(2)) : 0,
      monthlyRate: dailyRate !== undefined ? Number((Number(dailyRate) * 26).toFixed(2)) : 0,
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

    const activeBranch = query.assignedBranch;
    const Attendance = require('../models/Attendance');
    const attendancesThisWeek = await Attendance.find({
      cafeId,
      branchId: activeBranch,
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
      
      const sAttendances = attendancesThisWeek.filter(a => a.staffId && a.staffId.toString() === s._id.toString());
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
        const baseDailyRate = s.dailyRate || 0;
        const requiredHours = s.requiredHours || 8;
        const workingHours = durationMin / 60;

        // Salary = Daily Wage * Actual Hours Worked / Required Daily Hours
        let earnings = (baseDailyRate * (workingHours + overtimeHours)) / requiredHours;

        earnings = Number(earnings.toFixed(2));
        weeklyBreakdown[dayName] = Number(((weeklyBreakdown[dayName] || 0) + earnings).toFixed(2));
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
    salaryType, dailyRate, requiredHours, hourlyRate, weeklyRate, monthlyRate, weeklyOff, joiningDate, salaryStatus
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
    if (requiredHours !== undefined) {
      staffMember.requiredHours = Number(requiredHours);
    }
    if (dailyRate !== undefined || requiredHours !== undefined) {
      const baseDailyRate = dailyRate !== undefined ? Number(dailyRate) : staffMember.dailyRate;
      const reqHours = staffMember.requiredHours || 8;
      staffMember.dailyRate = baseDailyRate;
      staffMember.hourlyRate = Number((baseDailyRate / reqHours).toFixed(2));
      staffMember.weeklyRate = Number((baseDailyRate * 6).toFixed(2));
      staffMember.monthlyRate = Number((baseDailyRate * 26).toFixed(2));
    }
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
  if (!cafeId) return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });

  const { type, branchId, startDate, endDate } = req.query;
  if (!type) return res.status(400).json({ success: false, message: 'Report type is required' });

  try {
    let dateFilter = {};
    if (startDate && endDate) {
      const [sYear, sMonth, sDate] = startDate.split('-').map(Number);
      const start = new Date(Date.UTC(sYear, sMonth - 1, sDate) - (5.5 * 60 * 60 * 1000));
      const [eYear, eMonth, eDate] = endDate.split('-').map(Number);
      const end = new Date(Date.UTC(eYear, eMonth - 1, eDate + 1) - (5.5 * 60 * 60 * 1000) - 1);
      dateFilter = { $gte: start, $lte: end };
    }

    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user?.role || '').toLowerCase());
    const finalBranchId = isStaff ? req.user.assignedBranch : (branchId === 'all' ? null : branchId);

    const matchQuery = { cafeId };
    if (finalBranchId) {
      const branchDoc = await getCachedBranch(`mode:${finalBranchId}:${cafeId}`, () => Branch.findOne({
        $or: [
          { branchId: finalBranchId },
          { _id: mongoose.isValidObjectId(finalBranchId) ? finalBranchId : undefined }
        ],
        cafeId
      }).lean());

      if (branchDoc) {
        matchQuery.branchId = {
          $in: [
            branchDoc.branchId,
            String(branchDoc._id),
            branchDoc._id
          ]
        };
      } else {
        matchQuery.branchId = finalBranchId;
      }
    }
    
    const dateMatchQuery = { ...matchQuery };
    if (startDate && endDate) dateMatchQuery.createdAt = dateFilter;
    
    const attendanceMatch = { ...matchQuery };
    if (startDate && endDate) attendanceMatch.date = { $gte: startDate, $lte: endDate };

    let reportData = [];

    switch (type) {
      case 'revenue': {
        const pipeline = [
          { $match: { ...dateMatchQuery, status: 'Completed', paymentStatus: 'Paid' } },
          { $project: {
            invoiceNumber: { $cond: [{ $ifNull: ['$invoiceNumber', false] }, '$invoiceNumber', { $substr: [{ $toString: '$_id' }, 18, 6] }] },
            createdAt: 1, branchId: 1, paymentMethod: 1, paymentStatus: 1, totalAmount: 1, gstAmount: 1, discount: 1, serviceCharge: 1
          }},
          { $sort: { createdAt: -1 } }
        ];
        const orders = await Order.aggregate(pipeline);
        reportData = orders.map(o => ({
          orderId: o._id.toString(),
          invoiceNumber: (o.invoiceNumber || '').toUpperCase(),
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
        const pipeline = [
          { $match: dateMatchQuery },
          { $sort: { createdAt: -1 } }
        ];
        const orders = await Order.aggregate(pipeline);
        reportData = orders.map(o => ({
          orderId: o._id.toString(),
          customer: o.customerName || 'Anonymous',
          table: o.tableNumber || 'N/A',
          items: (o.items || []).map(i => i.name + ' x' + i.quantity).join(', '),
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
        const pipeline = [
          { $match: matchQuery },
          { $sort: { name: 1 } }
        ];
        const items = await Inventory.aggregate(pipeline);
        reportData = items.map(item => ({
          ingredient: item.name,
          category: item.category || 'General',
          currentStock: item.quantity || 0,
          minimumStock: item.minStock || 0,
          unit: item.unit || 'units',
          unitCost: item.cost || 0,
          inventoryValue: (item.quantity || 0) * (item.cost || 0),
          supplier: item.supplier || 'N/A'
        }));
        break;
      }
      case 'inventory_consumption': {
        const pipeline = [
          { $match: { ...dateMatchQuery, type: 'Deduction' } },
          {
            $lookup: {
              from: 'orders',
              localField: 'orderId',
              foreignField: '_id',
              as: 'order'
            }
          },
          {
            $match: {
              $or: [
                { orderId: { $exists: false } },
                { orderId: null },
                { 'order.status': 'Completed', 'order.paymentStatus': 'Paid' }
              ]
            }
          },
          { $group: {
            _id: '$itemName',
            consumedQuantity: { $sum: { $abs: '$quantityChanged' } },
            consumedCost: { $sum: '$cost' },
            logCount: { $sum: 1 }
          }},
          { $sort: { consumedCost: -1 } }
        ];
        const logs = await InventoryLog.aggregate(pipeline);
        reportData = logs.map(log => ({
          ingredient: log._id,
          consumedQuantity: log.consumedQuantity,
          consumedCost: log.consumedCost,
          logCount: log.logCount
        }));
        break;
      }
      case 'purchases': {
        const pipeline = [
          { $match: { ...dateMatchQuery, type: 'Purchase' } },
          { $sort: { createdAt: -1 } }
        ];
        const logs = await InventoryLog.aggregate(pipeline);
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
        const records = await Attendance.find(attendanceMatch).sort({ date: -1 }).lean();
        const grouped = {};
        for (const r of records) {
          const key = r.userEmail || r.userId?.toString() || 'Unknown';
          if (!grouped[key]) {
            grouped[key] = { employee: r.userName || r.userEmail || 'Staff Member', present: 0, absent: 0, late: 0, workingHours: 0, overtime: 0 };
          }
          if (r.status === 'Present') grouped[key].present += 1;
          else if (r.status === 'Absent') grouped[key].absent += 1;
          if (r.isLate) grouped[key].late += 1;
          grouped[key].workingHours += r.workingHours || 0;
          grouped[key].overtime += r.overtime || 0;
        }
        reportData = Object.values(grouped);
        break;
      }
      case 'payroll': {
        const payrolls = await Payroll.find(matchQuery).sort({ createdAt: -1 }).lean();
        reportData = payrolls.map(p => ({
          employee: p.userName || 'Employee',
          role: p.userRole || 'Staff',
          workingDays: p.workingDays || 0,
          actualHours: p.workingHours || 0,
          dailyWage: p.dailyWage || 0,
          calculatedSalary: p.salary || 0,
          monthlySalary: p.salary || 0
        }));
        break;
      }
      case 'top_selling': {
        const pipeline = [
          { $match: { ...dateMatchQuery, status: 'Completed', paymentStatus: 'Paid' } },
          { $unwind: '$items' },
          { $group: {
            _id: '$items.name',
            quantitySold: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
            ordersCount: { $addToSet: '$_id' }
          }},
          { $sort: { quantitySold: -1 } }
        ];
        const topSelling = await Order.aggregate(pipeline);
        reportData = topSelling.map(item => ({
          menuItem: item._id,
          quantitySold: item.quantitySold,
          revenue: item.revenue,
          ordersCount: item.ordersCount.length
        }));
        break;
      }
      case 'low_stock': {
        const Inventory = require('../models/Inventory');
        const reqBranchId = req.query.branchId || 'all';
        const pipeline = [
          { $match: { cafeId: req.user.cafeId } }
        ];
        if (reqBranchId && reqBranchId !== 'all') {
          const branchDoc = await getCachedBranch(`mode:${reqBranchId}:${req.user.cafeId}`, () => Branch.findOne({
            $or: [
              { branchId: reqBranchId },
              { _id: mongoose.isValidObjectId(reqBranchId) ? reqBranchId : undefined }
            ],
            cafeId: req.user.cafeId
          }).lean());

          const branchIds = branchDoc ? [branchDoc.branchId, String(branchDoc._id), branchDoc._id] : [reqBranchId];
          pipeline[0].$match.$or = [
            { branch: { $in: branchIds } },
            { branchId: { $in: branchIds } }
          ];
        }
        
        const items = await Inventory.aggregate(pipeline);
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
        const pipeline = [
          { $match: { ...dateMatchQuery, status: 'Completed', paymentStatus: 'Paid' } },
          { $group: {
            _id: { $ifNull: ['$paymentMethod', 'UPI'] },
            orderCount: { $sum: 1 },
            netRevenue: { $sum: { $subtract: ['$totalAmount', { $ifNull: ['$gstAmount', 0] }] } },
            tax: { $sum: { $ifNull: ['$gstAmount', 0] } },
            grandTotal: { $sum: '$totalAmount' }
          }},
          { $sort: { grandTotal: -1 } }
        ];
        const payments = await Order.aggregate(pipeline);
        reportData = payments.map(p => ({
          paymentMethod: p._id,
          orderCount: p.orderCount,
          netRevenue: p.netRevenue,
          tax: p.tax,
          grandTotal: p.grandTotal
        }));
        break;
      }
      case 'profit_summary': {
        const revenueAgg = await Order.aggregate([
          { $match: { ...dateMatchQuery, status: 'Completed', paymentStatus: 'Paid' } },
          { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
        ]);
        const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;
        
        const inventoryAgg = await Inventory.aggregate([
          { $match: matchQuery },
          { $group: { _id: null, inventoryValue: { $sum: { $multiply: ['$quantity', '$cost'] } } } }
        ]);
        const inventoryValue = inventoryAgg.length > 0 ? inventoryAgg[0].inventoryValue : 0;

        const consumptionAgg = await InventoryLog.aggregate([
          { $match: { ...dateMatchQuery, type: 'Deduction' } },
          {
            $lookup: {
              from: 'orders',
              localField: 'orderId',
              foreignField: '_id',
              as: 'order'
            }
          },
          {
            $match: {
              $or: [
                { orderId: { $exists: false } },
                { orderId: null },
                { 'order.status': 'Completed', 'order.paymentStatus': 'Paid' }
              ]
            }
          },
          { $group: { _id: null, totalConsumption: { $sum: '$cost' } } }
        ]);
        const inventoryConsumption = consumptionAgg.length > 0 ? consumptionAgg[0].totalConsumption : 0;

        const purchasesAgg = await InventoryLog.aggregate([
          { $match: { ...dateMatchQuery, type: 'Purchase' } },
          { $group: { _id: null, totalPurchase: { $sum: '$cost' } } }
        ]);
        const purchaseCost = purchasesAgg.length > 0 ? purchasesAgg[0].totalPurchase : 0;

        const grossProfit = totalRevenue - inventoryConsumption;
        const netProfit = grossProfit;
        const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        reportData = [{
          grossRevenue: totalRevenue,
          inventoryCost: inventoryValue,
          inventoryConsumption,
          purchaseCost,
          grossProfit,
          netProfit,
          profitMarginPercent: profitMargin
        }];
        break;
      }
      case 'financial_summary': {
        const orderAgg = Order.aggregate([
          { $match: { ...dateMatchQuery, status: 'Completed', paymentStatus: 'Paid' } },
          { $group: {
            _id: null,
            grossRevenue: { $sum: '$totalAmount' },
            taxes: { $sum: { $ifNull: ['$gstAmount', 0] } },
            discounts: { $sum: { $ifNull: ['$discount', 0] } }
          }}
        ]);

        const inventoryPurchaseAgg = InventoryLog.aggregate([
          { $match: { ...dateMatchQuery, type: 'Purchase' } },
          { $group: { _id: null, totalPurchaseCost: { $sum: '$cost' } } }
        ]);

        const inventoryWastageAgg = InventoryLog.aggregate([
          { $match: { ...dateMatchQuery, type: { $in: ['Wastage', 'Damaged', 'Shortage'] } } },
          { $group: { _id: null, totalWastageCost: { $sum: '$cost' } } }
        ]);

        const payrollAgg = Payroll.aggregate([
          { $match: { ...dateMatchQuery, paymentStatus: 'Paid' } },
          { $group: { _id: null, totalLaborCost: { $sum: '$netSalary' } } }
        ]);

        const [orderRes, purchaseRes, wastageRes, payrollRes] = await Promise.all([
          orderAgg, inventoryPurchaseAgg, inventoryWastageAgg, payrollAgg
        ]);

        const o = orderRes[0] || { grossRevenue: 0, taxes: 0, discounts: 0 };
        const grossRevenue = o.grossRevenue || 0;
        const taxes = o.taxes || 0;
        const discounts = o.discounts || 0;
        const netRevenue = grossRevenue - taxes;

        const purchaseCost = purchaseRes[0]?.totalPurchaseCost || 0;
        const wastageCost = wastageRes[0]?.totalWastageCost || 0;
        const laborCost = payrollRes[0]?.totalLaborCost || 0;

        const grossProfit = netRevenue - (purchaseCost + laborCost);

        reportData = [{
          grossRevenue: grossRevenue,
          taxesCollected: taxes,
          discountsGiven: discounts,
          netRevenue: netRevenue,
          inventoryPurchaseCost: purchaseCost,
          inventoryWastageCost: wastageCost,
          laborCost: laborCost,
          grossProfit: grossProfit
        }];
        break;
      }
      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    return res.status(200).json({ success: true, type, count: reportData.length, data: reportData });
  } catch (error) {
    console.error('Get reports error:', error);
    return res.status(500).json({ success: false, message: 'Server error generating reports' });
  }
};



// Active branches in-memory cache with 60s TTL for adminController
const branchCache = new Map();
const CACHE_TTL = 60000; // 60 seconds

const getCachedBranch = async (cacheKey, queryFn) => {
  const now = Date.now();
  if (branchCache.has(cacheKey)) {
    const entry = branchCache.get(cacheKey);
    if (now - entry.timestamp < CACHE_TTL) {
      return entry.data;
    }
  }
  const result = await queryFn();
  branchCache.set(cacheKey, { data: result, timestamp: now });
  return result;
};

// Inline helper to append fallback values to legacy orders for recentOrders
const appendLegacyFallback = async (order, branchMap = null) => {
  if (!order) return order;
  const orderObj = order.toObject ? order.toObject() : order;

  if (orderObj.branchId && mongoose.isValidObjectId(orderObj.branchId)) {
    let branchDoc;
    const branchIdStr = String(orderObj.branchId);
    if (branchMap && branchMap.has(branchIdStr)) {
      branchDoc = branchMap.get(branchIdStr);
    } else {
      branchDoc = await getCachedBranch(`id:${branchIdStr}`, () => Branch.findById(orderObj.branchId).lean());
      if (branchMap && branchDoc) branchMap.set(branchIdStr, branchDoc);
    }
    if (branchDoc) {
      orderObj.branchObjectId = branchIdStr;
      orderObj.branchId = branchDoc.branchId;
    }
  }

  if (!orderObj.branchId || !orderObj.branchName) {
    let defaultBranch;
    const targetCafeId = orderObj.cafeId || 'CD001';
    if (branchMap && branchMap.has(targetCafeId)) {
      defaultBranch = branchMap.get(targetCafeId);
    } else {
      defaultBranch = await getCachedBranch(`cafe:${targetCafeId}`, () => Branch.findOne({ cafeId: targetCafeId }).lean()) || {
        _id: null,
        branchName: 'DR . Chai Cafe',
        address: 'Comrade Puchalapalli Sundarayya Road, Yerrapalem'
      };
      if (branchMap) branchMap.set(targetCafeId, defaultBranch);
    }
    orderObj.branchId = orderObj.branchId || defaultBranch.branchId || 'default';
    orderObj.branchName = orderObj.branchName || defaultBranch.branchName;
    orderObj.branchAddress = orderObj.branchAddress || defaultBranch.address;
  }

  if (!orderObj.grandTotal) {
    orderObj.grandTotal = orderObj.totalAmount || 0;
    orderObj.subtotal = Number((orderObj.grandTotal / 1.05).toFixed(2));
    orderObj.tax = Number((orderObj.grandTotal - orderObj.subtotal).toFixed(2));
  }
  return orderObj;
};

const getDashboardStats = async (req, res) => {
  try {
    const cafeId = req.user.cafeId;
    if (!cafeId) return res.status(400).json({ success: false, message: 'No cafe assignment found.' });
    
    const branchId = req.query.branchId || null;
    
    const orderMatchQuery = { cafeId };
    
    // Branch filtering (supports both ObjectId and String code)
    let branchDoc = null;
    if (branchId && branchId !== 'all') {
      branchDoc = await getCachedBranch(`mode:${branchId}:${cafeId}`, () => Branch.findOne({ 
        $or: [
          { branchId: branchId },
          { _id: mongoose.isValidObjectId(branchId) ? branchId : undefined }
        ],
        cafeId
      }).lean());
      
      if (branchDoc) {
        orderMatchQuery.branchId = { 
          $in: [
            branchDoc.branchId, 
            String(branchDoc._id),
            branchDoc._id
          ] 
        };
      } else {
        orderMatchQuery.branchId = branchId;
      }
    }

    // Timezone-aware date calculations for Indian Standard Time (IST, UTC+5:30)
    const now = new Date();
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    const year = istTime.getUTCFullYear();
    const month = istTime.getUTCMonth();
    const date = istTime.getUTCDate();

    const startOfToday = new Date(Date.UTC(year, month, date) - (5.5 * 60 * 60 * 1000));
    
    const day = istTime.getUTCDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const startOfWeek = new Date(Date.UTC(year, month, date) - (diffToMonday * 24 * 60 * 60 * 1000) - (5.5 * 60 * 60 * 1000));
    
    const startOfMonth = new Date(Date.UTC(year, month, 1) - (5.5 * 60 * 60 * 1000));
    
    const startOfYear = new Date(Date.UTC(year, 0, 1) - (5.5 * 60 * 60 * 1000));

    // Completed & Paid orders for revenue calculations
    const revenueMatch = {
      ...orderMatchQuery,
      status: 'Completed',
      paymentStatus: 'Paid'
    };
    
    const invMatchQuery = { cafeId };
    if (branchId && branchId !== 'all') {
      if (branchDoc) {
        invMatchQuery.branchId = { $in: [branchDoc.branchId, String(branchDoc._id), branchDoc._id] };
      } else {
        invMatchQuery.branchId = branchId;
      }
    }
    
    const invLogMatch = { cafeId };
    if (branchId && branchId !== 'all') {
      if (branchDoc) {
        invLogMatch.branchId = { $in: [branchDoc.branchId, String(branchDoc._id), branchDoc._id] };
      } else {
        invLogMatch.branchId = branchId;
      }
    }

    const sevenDaysAgo = new Date(startOfToday.getTime() - (6 * 24 * 60 * 60 * 1000));

    // Execute all dashboard queries in parallel to drastically improve performance
    const [
      revenueStats,
      sourceStats,
      allSalesItems,
      inventoryValueAgg,
      inventoryLogStats,
      ordersToday,
      completedOrders,
      pendingOrders,
      paymentStats,
      weeklySalesAgg,
      recentOrders,
      allBranches
    ] = await Promise.all([
      Order.aggregate([
        { $match: revenueMatch },
        { 
          $group: {
            _id: null,
            totalRevenueAllTime: { $sum: '$totalAmount' },
            todayRevenue: { 
              $sum: { 
                $cond: [ { $gte: ['$createdAt', startOfToday] }, '$totalAmount', 0 ] 
              } 
            },
            weeklyRevenue: { 
              $sum: { 
                $cond: [ { $gte: ['$createdAt', startOfWeek] }, '$totalAmount', 0 ] 
              } 
            },
            monthlyRevenue: { 
              $sum: { 
                $cond: [ { $gte: ['$createdAt', startOfMonth] }, '$totalAmount', 0 ] 
              } 
            },
            yearlyRevenue: { 
              $sum: { 
                $cond: [ { $gte: ['$createdAt', startOfYear] }, '$totalAmount', 0 ] 
              } 
            },
            completedOrdersCount: { $sum: 1 }
          }
        }
      ]),
      Order.aggregate([
        { $match: revenueMatch },
        { $group: { _id: '$orderSource', count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: { ...revenueMatch, createdAt: { $gte: startOfMonth } } },
        { $unwind: '$items' },
        { 
          $group: {
            _id: '$items.name',
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
          }
        },
        { $sort: { quantity: -1 } }
      ]),
      Inventory.aggregate([
        { $match: invMatchQuery },
        { $group: { _id: null, totalValue: { $sum: { $multiply: ['$quantity', '$cost'] } } } }
      ]),
      InventoryLog.aggregate([
        { $match: invLogMatch },
        {
          $lookup: {
            from: 'orders',
            localField: 'orderId',
            foreignField: '_id',
            as: 'order'
          }
        },
        {
          $match: {
            $or: [
              { type: { $ne: 'Deduction' } },
              { orderId: { $exists: false } },
              { orderId: null },
              { 'order.status': 'Completed', 'order.paymentStatus': 'Paid' }
            ]
          }
        },
        {
          $group: {
            _id: '$type',
            totalCost: { $sum: '$cost' }
          }
        }
      ]),
      Order.countDocuments({
        ...orderMatchQuery,
        createdAt: { $gte: startOfToday }
      }),
      Order.countDocuments(revenueMatch),
      Order.countDocuments({
        ...orderMatchQuery,
        paymentStatus: { $ne: 'Failed' },
        $or: [
          { status: { $ne: 'Completed' } },
          { paymentStatus: { $ne: 'Paid' } }
        ]
      }),
      Order.aggregate([
        { $match: revenueMatch },
        { $group: { _id: '$paymentMethod', amount: { $sum: '$totalAmount' }, count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { 
          $match: { 
            ...revenueMatch, 
            createdAt: { $gte: sevenDaysAgo } 
          } 
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: '+05:30' }
            },
            sales: { $sum: '$totalAmount' }
          }
        }
      ]),
      Order.find(orderMatchQuery)
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Branch.find().lean()
    ]);
    
    let salesItems = allSalesItems;
    if (salesItems.length === 0) {
      salesItems = await Order.aggregate([
        { $match: revenueMatch },
        { $unwind: '$items' },
        { 
          $group: {
            _id: '$items.name',
            quantity: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
          }
        },
        { $sort: { quantity: -1 } }
      ]);
    }

    const revenueData = revenueStats.length > 0 ? revenueStats[0] : { 
      totalRevenueAllTime: 0, 
      todayRevenue: 0, 
      weeklyRevenue: 0,
      monthlyRevenue: 0, 
      yearlyRevenue: 0,
      completedOrdersCount: 0 
    };
    
    const orderSourceData = { QR: 0, POS: 0, Counter: 0 };
    sourceStats.forEach(stat => {
      if (stat._id === 'QR') orderSourceData.QR = stat.count;
      else if (stat._id === 'Staff POS' || stat._id === 'Waiter' || stat._id === 'POS' || stat._id === 'MANUAL') orderSourceData.POS += stat.count;
      else orderSourceData.Counter += stat.count;
    });
    
    const formattedSalesItems = salesItems.map(item => ({
      name: item._id,
      quantity: item.quantity,
      revenue: item.revenue
    }));
    const formattedTopSelling = formattedSalesItems.slice(0, 5);
    const formattedSlowSelling = formattedSalesItems.length > 5
      ? formattedSalesItems.slice(-5).reverse()
      : formattedSalesItems.slice().reverse();
    
    const inventoryValue = inventoryValueAgg.length > 0 ? inventoryValueAgg[0].totalValue : 0;
    
    let totalInventoryCost = 0;
    let totalInventoryConsumption = 0;
    inventoryLogStats.forEach(stat => {
      if (stat._id === 'Purchase') totalInventoryCost += stat.totalCost;
      else if (stat._id === 'Deduction') totalInventoryConsumption += stat.totalCost;
    });

    const averageOrderValue = revenueData.completedOrdersCount > 0 
      ? Number((revenueData.totalRevenueAllTime / revenueData.completedOrdersCount).toFixed(2)) 
      : 0;

    // Payment Summary (Grouped by payment method)
    const paymentSummary = {};
    paymentStats.forEach(p => {
      const method = p._id || 'Pending';
      paymentSummary[method] = { amount: p.amount, count: p.count };
    });

    // Populate weeklySalesData from aggregated weeklySalesMap
    const weeklySalesMap = {};
    weeklySalesAgg.forEach(item => {
      weeklySalesMap[item._id] = item.sales;
    });

    const weeklySalesData = [];
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 6; i >= 0; i--) {
      const dIST = new Date(startOfToday.getTime() - (i * 24 * 60 * 60 * 1000));
      const targetTime = new Date(dIST.getTime() + (5.5 * 60 * 60 * 1000));
      const dateStr = targetTime.toISOString().split('T')[0];
      const sales = weeklySalesMap[dateStr] || 0;
      weeklySalesData.push({
        day: i === 0 ? 'Today' : dayLabels[targetTime.getUTCDay()],
        sales: Math.round(sales * 100) / 100
      });
    }

    const branchMap = new Map();
    allBranches.forEach(b => {
      branchMap.set(String(b._id), b);
      branchMap.set(String(b.branchId), b);
      if (!branchMap.has(`cafe:${b.cafeId}`)) {
        branchMap.set(`cafe:${b.cafeId}`, b);
      }
    });

    const formattedRecentOrders = [];
    for (const order of recentOrders) {
      formattedRecentOrders.push(await appendLegacyFallback(order, branchMap));
    }
    
    return res.status(200).json({
      success: true,
      data: {
        todayRevenue: revenueData.todayRevenue,
        weeklyRevenue: revenueData.weeklyRevenue,
        monthlyRevenue: revenueData.monthlyRevenue,
        yearlyRevenue: revenueData.yearlyRevenue,
        ordersToday,
        completedOrders,
        pendingOrders,
        averageOrderValue,
        paymentSummary,
        orderSourceData,
        topSellingItems: formattedTopSelling,
        slowSellingItems: formattedSlowSelling,
        weeklySalesData,
        recentOrders: formattedRecentOrders,
        inventory: {
          value: inventoryValue,
          cost: totalInventoryCost,
          consumption: totalInventoryConsumption
        }
      }
    });
    
  } catch (error) {
    console.error('Error calculating dashboard stats:', error);
    res.status(500).json({ success: false, message: 'Server Error calculating stats' });
  }
};


module.exports = {
  getDashboardStats,
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
