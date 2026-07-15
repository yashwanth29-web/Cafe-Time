const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Cafe = require('../models/Cafe');

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

// Helper: Get IST Date String (YYYY-MM-DD)
const getISTDate = (date = new Date()) => {
  const tzOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(date.getTime() + tzOffset);
  return istTime.toISOString().split('T')[0];
};

// Helper: Calculate Distance using Haversine formula (in meters)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaPhi = (lat2 - lat1) * Math.PI / 180;
  const deltaLambda = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // distance in meters
};

/**
 * Staff Check In
 */
const checkIn = async (req, res) => {
  const { latitude, longitude, deviceInfo } = req.body;
  const staffId = req.user._id;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'GPS coordinates (latitude, longitude) are required' });
  }

  try {
    // 1. Verify user is staff
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    let branch;
    const hasBranches = await Branch.exists({ cafeId: staff.cafeId });
    if (!hasBranches) {
      // Single-Cafe Mode: Auto create/fetch default branch
      branch = await Branch.findOne({ branchId: 'default', cafeId: staff.cafeId });
      if (!branch) {
        const cafe = await Cafe.findOne({ cafeId: staff.cafeId });
        const { lat, lng } = parseCoords(cafe?.mapsLocation);
        branch = await Branch.create({
          branchId: 'default',
          branchName: 'Primary Location',
          cafeId: staff.cafeId,
          address: (cafe && cafe.address) || 'Default Address',
          manager: 'Owner',
          latitude: lat,
          longitude: lng,
          allowedRadius: 30,
          isActive: true
        });
      }
    } else {
      // Multi-Branch Mode: Enforce staff.assignedBranch
      if (!staff.assignedBranch) {
        return res.status(400).json({ success: false, message: 'No branch assigned to your account. Please contact manager.' });
      }
      branch = await Branch.findOne({ branchId: staff.assignedBranch, cafeId: staff.cafeId });
      if (!branch) {
        return res.status(404).json({ success: false, message: 'Assigned branch not found' });
      }
    }

    if (!branch.isActive) {
      return res.status(400).json({ success: false, message: 'Assigned branch is currently inactive' });
    }

    // Distance Validation with fallback to Cafe coordinates
    let checkLat = branch.latitude;
    let checkLng = branch.longitude;
    let allowedRadius = branch.allowedRadius || 100;

    const isBranchGeoConfigured = typeof checkLat === 'number' && checkLat !== 0 &&
                                  typeof checkLng === 'number' && checkLng !== 0;
    
    let isGeoConfigured = isBranchGeoConfigured;
    let distance = 0;

    let cafeLat = 0;
    let cafeLng = 0;
    let isCafeGeoConfigured = false;

    const cafe = await Cafe.findOne({ cafeId: staff.cafeId });
    if (cafe) {
      if (typeof cafe.latitude === 'number' && cafe.latitude !== 0 && typeof cafe.longitude === 'number' && cafe.longitude !== 0) {
        cafeLat = cafe.latitude;
        cafeLng = cafe.longitude;
        isCafeGeoConfigured = true;
      }
    }

    if (isBranchGeoConfigured) {
      distance = calculateDistance(Number(latitude), Number(longitude), Number(checkLat), Number(checkLng));
      if (distance > allowedRadius && isCafeGeoConfigured) {
        const distanceToCafe = calculateDistance(Number(latitude), Number(longitude), Number(cafeLat), Number(cafeLng));
        if (distanceToCafe <= allowedRadius) {
          distance = distanceToCafe;
          checkLat = cafeLat;
          checkLng = cafeLng;
        }
      }
    } else if (isCafeGeoConfigured) {
      checkLat = cafeLat;
      checkLng = cafeLng;
      isGeoConfigured = true;
      distance = calculateDistance(Number(latitude), Number(longitude), Number(checkLat), Number(checkLng));
    }

    if (isGeoConfigured && distance > allowedRadius) {
      return res.status(400).json({
        success: false,
        message: `Attendance restricted. You are ${Math.round(distance)} meters from the workplace location. Allowed geofence: ${allowedRadius} meters.`,
        distance: Math.round(distance),
        allowedRadius
      });
    }

    // 4. Auto-close previous days' open sessions
    const todayStr = getISTDate();
    const openSessions = await Attendance.find({ staffId, checkOutTime: { $exists: false } });
    for (const session of openSessions) {
      if (session.date !== todayStr) {
        const autoCheckOutTime = new Date(session.checkInTime.getTime() + 8 * 60 * 60 * 1000);
        session.checkOutTime = autoCheckOutTime;
        session.totalDuration = 480; // 8 hours in minutes
        session.workingHours = 8;
        await session.save();
      }
    }

    // 5. Duplicate checks
    const existingAttendance = await Attendance.findOne({ staffId, date: todayStr });
    if (existingAttendance) {
      return res.status(400).json({ success: false, message: 'You have already checked in today.' });
    }

    const activeSession = await Attendance.findOne({ staffId, checkOutTime: { $exists: false } });
    if (activeSession) {
      return res.status(400).json({ success: false, message: 'You already have an active session. Please check out first.' });
    }

    // 5. Late Check-in detection (opening time + 15 mins grace period)
    let isLate = false;
    try {
      if (branch && branch.openingTime) {
        const timeStr = branch.openingTime.replace(/\s*(AM|PM)\s*/i, '');
        const [opHour, opMin] = timeStr.split(':').map(Number);
        const isPM = /PM/i.test(branch.openingTime);
        
        const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const opHour24 = isPM && opHour < 12 ? opHour + 12 : (!isPM && opHour === 12 ? 0 : opHour);
        
        const checkHour = nowIST.getUTCHours();
        const checkMin = nowIST.getUTCMinutes();
        
        const opMinutesTotal = opHour24 * 60 + opMin;
        const checkMinutesTotal = checkHour * 60 + checkMin;
        
        if (checkMinutesTotal > opMinutesTotal + 15) {
          isLate = true;
        }
      }
    } catch (err) {
      console.error('Late check detection error:', err);
    }

    // 6. Handle check-in selfie if uploaded
    let image = '';
    let gridFsFileId = null;
    let gridFsFilename = '';

    if (req.file) {
      try {
        const { syncToGridFS } = require('../utils/gridfs');
        const gfsFile = await syncToGridFS(req.file);
        if (gfsFile) {
          const protocol = req.protocol;
          const host = req.get('host');
          image = `${protocol}://${host}/uploads/${req.file.filename}`;
          gridFsFileId = gfsFile._id;
          gridFsFilename = gfsFile.filename;
        }
      } catch (err) {
        console.error('Error syncing attendance selfie to GridFS:', err);
      }
    }

    // 7. Create record
    const attendance = await Attendance.create({
      staffId,
      staffName: staff.name,
      branchId: branch.branchId,
      branchName: branch.branchName,
      cafeId: staff.cafeId,
      date: todayStr,
      checkInTime: new Date(),
      latitude: Number(latitude),
      longitude: Number(longitude),
      distanceFromCafe: Math.round(distance),
      deviceInfo: deviceInfo || 'Web Browser',
      status: isLate ? 'Late' : 'Present',
      image,
      gridFsFileId,
      gridFsFilename
    });

    const msg = `Checked in successfully. Location verified successfully. You are ${Math.round(distance)} meters from the workplace location. Attendance recorded.${isLate ? ' (Late Arrival)' : ''}`;

    return res.status(201).json({
      success: true,
      message: msg,
      attendance
    });
  } catch (error) {
    console.error('checkIn error:', error);
    // Cleanup uploaded file if DB creation fails
    if (req.file && req.file.path) {
      const fs = require('fs');
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(500).json({ success: false, message: 'Server error processing check-in' });
  }
};

/**
 * Staff Check Out
 */
const checkOut = async (req, res) => {
  const staffId = req.user._id;
  const { latitude, longitude } = req.body;

  try {
    const session = await Attendance.findOne({ staffId, checkOutTime: { $exists: false } });
    if (!session) {
      return res.status(400).json({ success: false, message: 'No active check-in session found for today.' });
    }

    // Strict Radius Validation for Check-out
    if (latitude !== undefined && longitude !== undefined) {
      const branch = await Branch.findOne({ branchId: session.branchId, cafeId: session.cafeId });
      if (branch) {
        const isGeoConfigured = typeof branch.latitude === 'number' && branch.latitude !== 0 &&
                                typeof branch.longitude === 'number' && branch.longitude !== 0;
        if (isGeoConfigured) {
          const distance = calculateDistance(Number(latitude), Number(longitude), branch.latitude, branch.longitude);
          const allowedRadius = branch.allowedRadius || 100;
          if (distance > allowedRadius) {
            return res.status(400).json({
              success: false,
              message: `Checkout restricted. You are outside the allowed radius of ${allowedRadius} meters.`,
              distance: Math.round(distance),
              allowedRadius
            });
          }
        }
      }
    } else {
      return res.status(400).json({ success: false, message: 'GPS coordinates are required to check out.' });
    }

    const checkOutTime = new Date();
    const diffMs = checkOutTime.getTime() - session.checkInTime.getTime();
    const totalDuration = Math.round(diffMs / 60000); // in minutes

    session.checkOutTime = checkOutTime;
    session.totalDuration = totalDuration;
    session.workingHours = Number((totalDuration / 60).toFixed(2));
    await session.save();

    const hours = Math.floor(totalDuration / 60);
    const mins = totalDuration % 60;

    return res.status(200).json({
      success: true,
      message: `Checked out successfully. Shift duration: ${hours}h ${mins}m.`,
      attendance: session
    });
  } catch (error) {
    console.error('checkOut error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing check-out' });
  }
};

/**
 * Get Today's Attendance for Current Staff
 */
const getTodayStatus = async (req, res) => {
  const staffId = req.user._id;
  const todayStr = getISTDate();
  const { latitude, longitude } = req.query;

  try {
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    let branch = null;
    if (staff.assignedBranch) {
      branch = await Branch.findOne({ branchId: staff.assignedBranch, cafeId: staff.cafeId });
    }

    let distance = null;
    let allowedRadius = 100;
    let insideRadius = false;
    let branchName = 'No branch assigned';
    let branchLat = 0;
    let branchLng = 0;

    if (branch) {
      branchName = branch.branchName;
      allowedRadius = branch.allowedRadius || 100;
      branchLat = branch.latitude;
      branchLng = branch.longitude;

      if (latitude !== undefined && longitude !== undefined) {
        const isGeoConfigured = typeof branch.latitude === 'number' && branch.latitude !== 0 &&
                                typeof branch.longitude === 'number' && branch.longitude !== 0;
        if (isGeoConfigured) {
          distance = calculateDistance(Number(latitude), Number(longitude), branch.latitude, branch.longitude);
          insideRadius = distance <= allowedRadius;
        }
      }
    }

    // Check if there is an active session that has reached 8 hours (480 minutes)
    let session = await Attendance.findOne({ staffId, checkOutTime: { $exists: false } });
    if (session) {
      const now = new Date();
      const diffMs = now.getTime() - session.checkInTime.getTime();
      const durationMin = diffMs / 60000;
      
      if (durationMin >= 480) {
        // Auto-checkout at exactly 8 hours
        const autoCheckOutTime = new Date(session.checkInTime.getTime() + 8 * 60 * 60 * 1000);
        session.checkOutTime = autoCheckOutTime;
        session.totalDuration = 480;
        session.workingHours = 8;
        await session.save();
      }
    }

    const attendance = await Attendance.findOne({ staffId, date: todayStr });
    return res.status(200).json({
      success: true,
      checkedIn: !!attendance,
      checkedOut: attendance ? !!attendance.checkOutTime : false,
      attendance,
      branchName,
      allowedRadius,
      distance: distance !== null ? Math.round(distance) : null,
      insideRadius,
      latitude: branchLat,
      longitude: branchLng
    });
  } catch (error) {
    console.error('getTodayStatus error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving status' });
  }
};

/**
 * Get Attendance History for Current Staff (last 30 days)
 */
const getStaffHistory = async (req, res) => {
  const staffId = req.user._id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  try {
    const history = await Attendance.find({
      staffId,
      checkInTime: { $gte: thirtyDaysAgo }
    }).sort({ checkInTime: -1 });

    // Calculate monthly stats
    const totalWorkingMinutes = history.reduce((sum, record) => sum + (record.totalDuration || 0), 0);
    const totalHours = Number((totalWorkingMinutes / 60).toFixed(1));
    const lateCount = history.filter(r => r.status === 'Late').length;
    
    // Monthly percentage based on working days (approx 26 active working days a month, or out of 30 days)
    const activeDays = history.length;
    const attendancePercentage = Math.round((activeDays / 30) * 100);

    return res.status(200).json({
      success: true,
      history,
      summary: {
        totalWorkingHours: totalHours,
        attendancePercentage,
        lateDays: lateCount,
        presentDays: activeDays
      }
    });
  } catch (error) {
    console.error('getStaffHistory error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving history' });
  }
};

/**
 * Owner Dashboard: Today's Attendance Overview
 */
const getOwnerTodayDashboard = async (req, res) => {
  const cafeId = req.user.cafeId;
  const todayStr = getISTDate();

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your profile does not have a cafe assignment' });
  }

  try {
    const activeBranch = req.branchId || 'default';
    // Get all active staff members
    const staffList = await User.find({
      cafeId,
      assignedBranch: activeBranch,
      role: { $nin: ['super_admin', 'admin', 'owner', 'SUPER_ADMIN', 'ADMIN', 'OWNER'] },
      isActive: true
    });

    const todayRecords = await Attendance.find({ cafeId, branchId: activeBranch, date: todayStr }).lean();

    // Fetch Cafe to get openingTime and check if shift has started
    const cafe = await Cafe.findOne({ cafeId });
    let isBeforeOpening = false;
    if (cafe && cafe.openingTime) {
      try {
        const timeStr = cafe.openingTime.replace(/\s*(AM|PM)\s*/i, '');
        const [opHour, opMin] = timeStr.split(':').map(Number);
        const isPM = /PM/i.test(cafe.openingTime);
        const opHour24 = isPM && opHour < 12 ? opHour + 12 : (!isPM && opHour === 12 ? 0 : opHour);
        const opMinutes = opHour24 * 60 + (opMin || 0);

        const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
        const currentMinutes = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();

        if (currentMinutes < opMinutes) {
          isBeforeOpening = true;
        }
      } catch (err) {
        console.warn('Error parsing cafe openingTime for absent count:', err);
      }
    }

    // Calculations
    const presentCount = todayRecords.length;
    const absentCount = isBeforeOpening ? 0 : Math.max(0, staffList.length - presentCount);
    const lateCount = todayRecords.filter(r => r.status === 'Late').length;
    const checkedOutCount = todayRecords.filter(r => !!r.checkOutTime).length;
    const currentlyWorkingCount = presentCount - checkedOutCount;

    return res.status(200).json({
      success: true,
      summary: {
        totalStaff: staffList.length,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        checkedOut: checkedOutCount,
        currentlyWorking: currentlyWorkingCount
      },
      records: todayRecords
    });
  } catch (error) {
    console.error('getOwnerTodayDashboard error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving dashboard summary' });
  }
};

/**
 * Owner Dashboard: Attendance Reports
 */
const getOwnerReports = async (req, res) => {
  const cafeId = req.user.cafeId;
  const { range, branchId } = req.query; // range can be 'daily', 'weekly', 'monthly'

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your profile does not have a cafe assignment' });
  }

  try {
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (range === 'weekly') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (range === 'monthly') {
      startDate.setDate(startDate.getDate() - 30);
    } else {
      // Default daily (today only)
      startDate.setDate(startDate.getDate() - 1);
    }

    const activeBranch = branchId || req.branchId || 'default';
    const query = {
      cafeId,
      branchId: activeBranch,
      checkInTime: { $gte: startDate }
    };

    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user.role || '').toLowerCase());
    if (isStaff && req.user.assignedBranch) {
      query.branchId = req.user.assignedBranch;
    } else if (branchId) {
      query.branchId = branchId;
    }
    const records = await Attendance.find(query).sort({ checkInTime: -1 }).lean();
    const staffCount = await User.countDocuments({
      cafeId,
      assignedBranch: activeBranch,
      role: { $nin: ['super_admin', 'admin', 'owner', 'SUPER_ADMIN', 'ADMIN', 'OWNER'] },
      isActive: true
    });

    // 1. Total working hours
    const totalWorkingMinutes = records.reduce((sum, r) => sum + (r.totalDuration || 0), 0);
    const totalHours = Number((totalWorkingMinutes / 60).toFixed(1));

    // 2. Late arrivals count
    const lateArrivals = records.filter(r => r.status === 'Late').length;

    // 3. Branch-wise breakdown
    const branchBreakdown = {};
    records.forEach(r => {
      const bKey = r.branchName || r.branchId;
      if (!branchBreakdown[bKey]) {
        branchBreakdown[bKey] = {
          branchName: r.branchName,
          presentCount: 0,
          workingHours: 0
        };
      }
      branchBreakdown[bKey].presentCount += 1;
      branchBreakdown[bKey].workingHours += (r.totalDuration || 0) / 60;
    });

    const branchReports = Object.values(branchBreakdown).map(b => ({
      ...b,
      workingHours: Number(b.workingHours.toFixed(1))
    }));

    // 4. Attendance Percentage
    // (Actual present days / (staffCount * range_days)) * 100
    const rangeDays = range === 'weekly' ? 7 : range === 'monthly' ? 30 : 1;
    const totalPossibleShifts = staffCount * rangeDays;
    const attendancePercentage = totalPossibleShifts > 0 
      ? Math.round((records.length / totalPossibleShifts) * 100) 
      : 100;

    return res.status(200).json({
      success: true,
      summary: {
        totalHours,
        lateArrivals,
        attendancePercentage,
        recordCount: records.length
      },
      branchReports,
      records
    });
  } catch (error) {
    console.error('getOwnerReports error:', error);
    return res.status(500).json({ success: false, message: 'Server error compiling reports' });
  }
};

/**
 * Start Extra Work (Overtime)
 */
const startExtraWork = async (req, res) => {
  const staffId = req.user._id;
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'GPS coordinates are required' });
  }

  try {
    const todayStr = getISTDate();
    const attendance = await Attendance.findOne({ staffId, date: todayStr });

    if (!attendance) {
      return res.status(400).json({ success: false, message: 'You must check in first before starting extra work.' });
    }

    if (!attendance.checkOutTime) {
      return res.status(400).json({ success: false, message: 'Your regular shift is still running. You must complete your regular shift first.' });
    }

    if (attendance.isExtraWorkActive) {
      return res.status(400).json({ success: false, message: 'Extra work session is already active.' });
    }

    // Radius validation
    const branch = await Branch.findOne({ branchId: attendance.branchId, cafeId: attendance.cafeId });
    if (branch) {
      const isGeoConfigured = typeof branch.latitude === 'number' && branch.latitude !== 0 &&
                              typeof branch.longitude === 'number' && branch.longitude !== 0;
      if (isGeoConfigured) {
        const distance = calculateDistance(Number(latitude), Number(longitude), branch.latitude, branch.longitude);
        const allowedRadius = branch.allowedRadius || 100;
        if (distance > allowedRadius) {
          return res.status(400).json({
            success: false,
            message: `Extra work restricted. You are outside the allowed radius of ${allowedRadius} meters.`,
            distance: Math.round(distance),
            allowedRadius
          });
        }
      }
    }

    // Activate extra work
    attendance.isExtraWorkActive = true;
    attendance.extraWorkStartTime = new Date();
    await attendance.save();

    return res.status(200).json({
      success: true,
      message: 'Extra work started successfully.',
      attendance
    });
  } catch (error) {
    console.error('startExtraWork error:', error);
    return res.status(500).json({ success: false, message: 'Server error starting extra work' });
  }
};

/**
 * Stop Extra Work (Overtime)
 */
const stopExtraWork = async (req, res) => {
  const staffId = req.user._id;
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'GPS coordinates are required' });
  }

  try {
    const todayStr = getISTDate();
    const attendance = await Attendance.findOne({ staffId, date: todayStr });

    if (!attendance || !attendance.isExtraWorkActive) {
      return res.status(400).json({ success: false, message: 'No active extra work session found.' });
    }

    // Radius validation
    const branch = await Branch.findOne({ branchId: attendance.branchId, cafeId: attendance.cafeId });
    if (branch) {
      const isGeoConfigured = typeof branch.latitude === 'number' && branch.latitude !== 0 &&
                              typeof branch.longitude === 'number' && branch.longitude !== 0;
      if (isGeoConfigured) {
        const distance = calculateDistance(Number(latitude), Number(longitude), branch.latitude, branch.longitude);
        const allowedRadius = branch.allowedRadius || 100;
        if (distance > allowedRadius) {
          return res.status(400).json({
            success: false,
            message: `Stop extra work restricted. You are outside the allowed radius of ${allowedRadius} meters.`,
            distance: Math.round(distance),
            allowedRadius
          });
        }
      }
    }

    const now = new Date();
    const diffMs = now.getTime() - attendance.extraWorkStartTime.getTime();
    const overtimeHrs = Number((diffMs / 3600000).toFixed(2)); // in hours

    attendance.isExtraWorkActive = false;
    attendance.extraWorkEndTime = now;
    attendance.overtimeHours = (attendance.overtimeHours || 0) + overtimeHrs;
    await attendance.save();

    return res.status(200).json({
      success: true,
      message: `Extra work stopped successfully. Overtime added: ${overtimeHrs} hours.`,
      attendance
    });
  } catch (error) {
    console.error('stopExtraWork error:', error);
    return res.status(500).json({ success: false, message: 'Server error stopping extra work' });
  }
};

/**
 * Edit / Correct Attendance Log (Owner/Manager only)
 * PUT /api/attendance/:id
 */
const editAttendance = async (req, res) => {
  const { id } = req.params;
  const { 
    checkInTime, 
    checkOutTime, 
    status, 
    workingHours, 
    overtimeHours,
    date
  } = req.body;
  const cafeId = req.user.cafeId;

  try {
    const attendance = await Attendance.findOne({ _id: id, cafeId }, null, { bypassBranchFilter: true });
    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Attendance record not found in your cafe' });
    }

    if (req.user.role.toLowerCase() === 'manager' && req.user.assignedBranch && attendance.branchId !== req.user.assignedBranch) {
      return res.status(403).json({ success: false, message: "Unauthorized access to this branch's attendance logs" });
    }

    if (checkInTime !== undefined) attendance.checkInTime = new Date(checkInTime);
    if (checkOutTime !== undefined) {
      if (checkOutTime === null) {
        attendance.checkOutTime = undefined;
        attendance.totalDuration = 0;
        attendance.workingHours = 0;
      } else {
        attendance.checkOutTime = new Date(checkOutTime);
      }
    }
    if (status !== undefined) attendance.status = status;
    if (date !== undefined) attendance.date = date; // YYYY-MM-DD

    if (workingHours !== undefined) {
      attendance.workingHours = Number(workingHours);
      attendance.totalDuration = Math.round(Number(workingHours) * 60);
    } else if (attendance.checkInTime && attendance.checkOutTime) {
      const checkIn = attendance.checkInTime;
      const checkOut = attendance.checkOutTime;
      const diffMs = checkOut.getTime() - checkIn.getTime();
      const durationMin = Math.max(0, Math.round(diffMs / 60000));
      attendance.totalDuration = durationMin;
      attendance.workingHours = Number((durationMin / 60).toFixed(2));
    }

    if (overtimeHours !== undefined) {
      attendance.overtimeHours = Number(overtimeHours);
    }

    await attendance.save();

    return res.status(200).json({
      success: true,
      message: 'Attendance record corrected successfully.',
      attendance
    });
  } catch (error) {
    console.error('editAttendance error:', error);
    return res.status(500).json({ success: false, message: 'Server error correcting attendance record' });
  }
};

module.exports = {
  checkIn,
  checkOut,
  getTodayStatus,
  getStaffHistory,
  getOwnerTodayDashboard,
  getOwnerReports,
  startExtraWork,
  stopExtraWork,
  editAttendance
};
