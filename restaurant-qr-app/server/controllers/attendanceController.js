const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Branch = require('../models/Branch');
const Cafe = require('../models/Cafe');

// Helper: Parse coordinates from Google Maps URLs or strings
const parseCoordinates = (input) => {
  if (!input) return null;
  const str = String(input).trim();
  
  // 1. q=lat,lng
  const qMatch = str.match(/[?&](?:q|query)=([\d.-]+)\s*,\s*([\d.-]+)/i);
  if (qMatch) {
    return {
      latitude: parseFloat(qMatch[1]),
      longitude: parseFloat(qMatch[2])
    };
  }
  
  // 2. @lat,lng
  const atMatch = str.match(/@([\d.-]+)\s*,\s*([\d.-]+)/);
  if (atMatch) {
    return {
      latitude: parseFloat(atMatch[1]),
      longitude: parseFloat(atMatch[2])
    };
  }

  // 3. /place/lat,lng
  const placeMatch = str.match(/\/place\/([\d.-]+)\s*,\s*([\d.-]+)/i);
  if (placeMatch) {
    return {
      latitude: parseFloat(placeMatch[1]),
      longitude: parseFloat(placeMatch[2])
    };
  }

  // 4. simple lat,lng
  const simpleMatch = str.match(/^([\d.-]+)\s*,\s*([\d.-]+)$/);
  if (simpleMatch) {
    return {
      latitude: parseFloat(simpleMatch[1]),
      longitude: parseFloat(simpleMatch[2])
    };
  }

  // 5. general fallback for any lat,lng in the string
  const generalMatch = str.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (generalMatch) {
    return {
      latitude: parseFloat(generalMatch[1]),
      longitude: parseFloat(generalMatch[2])
    };
  }

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
        branch = await Branch.create({
          branchId: 'default',
          branchName: 'Primary Location',
          cafeId: staff.cafeId,
          address: (cafe && cafe.address) || 'Default Address',
          manager: 'Owner',
          latitude: 0,
          longitude: 0,
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

    // 3. Distance Validation (Fallback/Double check with Cafe coordinates if user is far from branch)
    let checkLat = branch.latitude;
    let checkLng = branch.longitude;
    let allowedRadius = branch.allowedRadius || 30;

    const isBranchGeoConfigured = typeof checkLat === 'number' && checkLat !== 0 &&
                                  typeof checkLng === 'number' && checkLng !== 0;
    
    let isGeoConfigured = isBranchGeoConfigured;
    let distance = 0;

    // Fetch Cafe coordinates for fallback/double-check
    let cafeLat = 0;
    let cafeLng = 0;
    let isCafeGeoConfigured = false;

    const cafe = await Cafe.findOne({ cafeId: staff.cafeId });
    if (cafe) {
      if (typeof cafe.latitude === 'number' && cafe.latitude !== 0 && typeof cafe.longitude === 'number' && cafe.longitude !== 0) {
        cafeLat = cafe.latitude;
        cafeLng = cafe.longitude;
        isCafeGeoConfigured = true;
      } else if (cafe.mapsLocation) {
        const coords = parseCoordinates(cafe.mapsLocation);
        if (coords) {
          cafeLat = coords.latitude;
          cafeLng = coords.longitude;
          isCafeGeoConfigured = true;
        }
      }
    }

    if (isBranchGeoConfigured) {
      distance = calculateDistance(Number(latitude), Number(longitude), Number(checkLat), Number(checkLng));
      
      // Double check: if they are too far from branch, check if they are near the main cafe location
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
      const cafe = await Cafe.findOne({ cafeId: staff.cafeId });
      if (cafe && cafe.openingTime) {
        const timeStr = cafe.openingTime.replace(/\s*(AM|PM)\s*/i, '');
        const [opHour, opMin] = timeStr.split(':').map(Number);
        const isPM = /PM/i.test(cafe.openingTime);
        
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

    // 6. Create record
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
      status: isLate ? 'Late' : 'Present'
    });

    const msg = `Checked in successfully. Location verified successfully. You are ${Math.round(distance)} meters from the workplace location. Attendance recorded.${isLate ? ' (Late Arrival)' : ''}`;

    return res.status(201).json({
      success: true,
      message: msg,
      attendance
    });
  } catch (error) {
    console.error('checkIn error:', error);
    return res.status(500).json({ success: false, message: 'Server error processing check-in' });
  }
};

/**
 * Staff Check Out
 */
const checkOut = async (req, res) => {
  const staffId = req.user._id;

  try {
    const session = await Attendance.findOne({ staffId, checkOutTime: { $exists: false } });
    if (!session) {
      return res.status(400).json({ success: false, message: 'No active check-in session found for today.' });
    }

    const checkOutTime = new Date();
    const diffMs = checkOutTime.getTime() - session.checkInTime.getTime();
    const totalDuration = Math.round(diffMs / 60000); // in minutes

    session.checkOutTime = checkOutTime;
    session.totalDuration = totalDuration;
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

  try {
    const attendance = await Attendance.findOne({ staffId, date: todayStr });
    return res.status(200).json({
      success: true,
      checkedIn: !!attendance,
      checkedOut: attendance ? !!attendance.checkOutTime : false,
      attendance
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
    // Get all active staff members
    const staffList = await User.find({
      cafeId,
      role: { $in: ['staff', 'chef', 'manager', 'waiter', 'cashier', 'STAFF', 'CHEF', 'MANAGER', 'WAITER', 'CASHIER'] },
      isActive: true
    });

    const todayRecords = await Attendance.find({ cafeId, date: todayStr });

    // Calculations
    const presentCount = todayRecords.length;
    const absentCount = Math.max(0, staffList.length - presentCount);
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

    const query = {
      cafeId,
      checkInTime: { $gte: startDate }
    };

    if (branchId) {
      query.branchId = branchId;
    }

    const records = await Attendance.find(query).sort({ checkInTime: -1 });
    const staffCount = await User.countDocuments({
      cafeId,
      role: { $in: ['staff', 'chef', 'manager', 'waiter', 'cashier'] },
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

module.exports = {
  checkIn,
  checkOut,
  getTodayStatus,
  getStaffHistory,
  getOwnerTodayDashboard,
  getOwnerReports
};
