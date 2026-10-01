const path = require('path');
const fs = require('fs');
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

// Helper: Parse time string ("06:10 PM", "18:10", "9:00 AM") into minutes from midnight
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  let hour = 0, min = 0;
  const isPM = /PM/i.test(timeStr);
  const isAM = /AM/i.test(timeStr);
  const clean = String(timeStr).replace(/\s*(AM|PM)\s*/i, '').trim();
  const parts = clean.split(':').map(Number);
  hour = parts[0] || 0;
  min = parts[1] || 0;
  if (isPM && hour < 12) hour += 12;
  if (isAM && hour === 12) hour = 0;
  return hour * 60 + min;
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

// Helper: Auto-checkout if shift ended >= 5 minutes ago
const checkAndApplyAutoCheckout = async (attendance, staff) => {
  if (!attendance) return false;

  // Find active session in shiftSessions, or root attendance
  const activeSession = (attendance.shiftSessions || []).find(s => !s.checkOutTime) ||
                        (attendance.activeSessionNumber > 0 ? attendance.shiftSessions?.find(s => s.sessionNumber === attendance.activeSessionNumber) : null);

  // If already checked out and no active session
  if (attendance.checkOutTime && (!activeSession || activeSession.checkOutTime)) {
    return false;
  }

  if (!staff && attendance.staffId) {
    const User = require('../models/User');
    staff = await User.findById(attendance.staffId).setOptions({ bypassBranchFilter: true });
  }

  // Determine target shift for the active session
  let targetShift = null;
  const activeShiftNum = activeSession ? activeSession.sessionNumber : (attendance.activeSessionNumber || 1);
  if (staff?.scheduleType === 'SPLIT' && Array.isArray(staff?.shifts) && staff.shifts.length > 0) {
    targetShift = staff.shifts.find(s => s.shiftNumber === activeShiftNum) ||
                  staff.shifts[activeShiftNum - 1] ||
                  staff.shifts[0];
  }

  const shiftStartTime = activeSession?.shiftStartTime || (targetShift && targetShift.startTime) || attendance.shiftStartTime || (staff && staff.shiftStartTime) || '09:00';
  const shiftEndTime = activeSession?.shiftEndTime || (targetShift && targetShift.endTime) || attendance.shiftEndTime || (staff && staff.shiftEndTime) || '18:00';

  let startMins = parseTimeToMinutes(shiftStartTime) ?? (9 * 60);
  let endMins = parseTimeToMinutes(shiftEndTime) ?? (18 * 60);
  if (endMins <= startMins) {
    endMins += 24 * 60; // Overnight shift
  }

  const now = new Date();
  const nowIST = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  let currentISTMins = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();
  if (endMins >= 24 * 60 && currentISTMins < startMins) {
    currentISTMins += 24 * 60;
  }

  const sessionCheckInTime = activeSession?.checkInTime ? new Date(activeSession.checkInTime) : new Date(attendance.checkInTime);
  const diffMs = now.getTime() - sessionCheckInTime.getTime();
  const durationMin = Math.max(1, Math.round(diffMs / 60000));

  // Auto-checkout condition: Current time >= shiftEndTime (immediate, no buffer) OR duration >= 480 mins
  const isShiftTimeOver = currentISTMins >= endMins;
  const isOverMaxDuration = durationMin >= 480;

  if (isShiftTimeOver || isOverMaxDuration) {
    const dailyRate = Number(attendance.dailyWageRate || (staff ? staff.dailyRate : 0) || 0);
    const totalConfiguredShifts = (staff?.scheduleType === 'SPLIT' && Array.isArray(staff?.shifts) && staff.shifts.length > 0)
      ? staff.shifts.length
      : ((attendance.shiftSessions && attendance.shiftSessions.length > 1) ? attendance.shiftSessions.length : 1);
    const shiftWageAllocation = Number((dailyRate / totalConfiguredShifts).toFixed(2));

    let penaltyDeduction = 0;
    if (activeSession?.isLateAfterGrace) {
      penaltyDeduction = activeSession.penaltyAmount || 100;
    }
    const sessionFinalWage = Math.max(0, Number((shiftWageAllocation - penaltyDeduction).toFixed(2)));

    if (activeSession) {
      activeSession.checkOutTime = now;
      activeSession.durationMinutes = durationMin;
      activeSession.workingHours = Number((durationMin / 60).toFixed(2));
      activeSession.sessionWage = sessionFinalWage;
      activeSession.status = activeSession.isLateAfterGrace ? 'Late' : 'Present';
      if (!activeSession.shiftStartTime) activeSession.shiftStartTime = shiftStartTime;
      if (!activeSession.shiftEndTime) activeSession.shiftEndTime = shiftEndTime;
    }

    const completedList = (attendance.shiftSessions || []).filter(s => !!s.checkOutTime);
    const totalDayDuration = completedList.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) || durationMin;
    const totalDayWorkingHours = Number((totalDayDuration / 60).toFixed(2));
    const totalDayWages = completedList.length > 0
      ? Number(completedList.reduce((acc, s) => acc + (s.sessionWage || 0), 0).toFixed(2))
      : sessionFinalWage;
    const totalDayPenalties = completedList.reduce((acc, s) => acc + (s.penaltyAmount || 0), 0);

    attendance.checkOutTime = now;
    attendance.totalDuration = totalDayDuration;
    attendance.workingHours = totalDayWorkingHours;
    attendance.dailyWageEarned = totalDayWages;
    attendance.totalPenaltyAmount = totalDayPenalties;
    attendance.activeSessionNumber = 0;
    attendance.autoCheckedOut = true;
    attendance.isWageFinalized = true;
    await attendance.save();
    return true;
  }

  return false;
};

const checkIn = async (req, res) => {
  const { latitude, longitude, deviceInfo, staffId: targetStaffId, employeeId, attendancePin } = req.body;
  let staffId = req.user._id;

  if (targetStaffId) {
    staffId = targetStaffId;
  } else if (employeeId) {
    const foundStaff = await User.findOne({ 
      employeeId: String(employeeId).trim(), 
      cafeId: req.user.cafeId || req.cafeId 
    });
    if (foundStaff) staffId = foundStaff._id;
  }

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ success: false, message: 'GPS coordinates (latitude, longitude) are required' });
  }

  try {
    // 1. Verify user is staff
    const staff = await User.findById(staffId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Staff member not found' });
    }

    // Verify 4-digit Attendance PIN (set by owner)
    if (staff.attendancePin && staff.attendancePin.trim() !== '') {
      if (!attendancePin || String(attendancePin).trim() !== String(staff.attendancePin).trim()) {
        return res.status(400).json({ 
          success: false, 
          message: `Incorrect 4-digit Attendance PIN for ${staff.name}. Please enter the PIN set by the owner.` 
        });
      }
    } else if (attendancePin && String(attendancePin).trim().length === 4) {
      staff.attendancePin = String(attendancePin).trim();
      await staff.save();
    }

    let branch;
    if (!staff.assignedBranch) {
      // Find any branch belonging to this cafe
      branch = await Branch.findOne({ cafeId: staff.cafeId });
      if (!branch) {
        return res.status(400).json({ success: false, message: 'No branch has been created yet. Please contact the owner.' });
      }
    } else {
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
    const openSessions = await Attendance.find({ staffId, checkOutTime: { $exists: false } }).setOptions({ bypassBranchFilter: true });
    for (const session of openSessions) {
      if (session.date !== todayStr) {
        const autoCheckOutTime = new Date(session.checkInTime.getTime() + 8 * 60 * 60 * 1000);
        session.checkOutTime = autoCheckOutTime;
        session.totalDuration = 480; // 8 hours in minutes
        session.workingHours = 8;
        await session.save();
      }
    }

    // 5. Multi-Shift & Open Session Verification
    const activeOpenAttendance = await Attendance.findOne({ 
      staffId, 
      date: todayStr,
      $or: [
        { activeSessionNumber: { $gt: 0 } },
        { checkOutTime: { $exists: false } },
        { checkOutTime: null }
      ]
    }).setOptions({ bypassBranchFilter: true });
    if (activeOpenAttendance) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already have an active checked-in shift session. Please clock out of your current shift first.' 
      });
    }

    let existingAttendance = await Attendance.findOne({ staffId, date: todayStr }).setOptions({ bypassBranchFilter: true });
    const completedSessions = (existingAttendance?.shiftSessions || []).filter(s => !!s.checkOutTime);
    if (completedSessions.length >= 4) {
      return res.status(400).json({ 
        success: false, 
        message: 'Maximum limit of 4 shifts for today has been reached.' 
      });
    }

    const currentShiftNumber = completedSessions.length + 1;

    // 6. Shift & Lean Time (Grace Period) Validation
    let targetShift = null;
    if (staff.scheduleType === 'SPLIT' && Array.isArray(staff.shifts) && staff.shifts.length > 0) {
      targetShift = staff.shifts.find(s => s.shiftNumber === currentShiftNumber) ||
                    staff.shifts[currentShiftNumber - 1] ||
                    staff.shifts[0];
    }
    const shiftStartTime = (targetShift && targetShift.startTime) || staff.shiftStartTime || '09:00';
    const shiftEndTime = (targetShift && targetShift.endTime) || staff.shiftEndTime || '18:00';
    const currentShiftLabel = (targetShift && targetShift.shiftLabel) ? targetShift.shiftLabel : `Shift ${currentShiftNumber}`;
    const leanTimeMinutes = staff.leanTimeMinutes !== undefined ? Number(staff.leanTimeMinutes) : 30;

    const dailyRate = Number(staff.dailyRate || 0);
    const requiredHours = Number(staff.requiredHours || 8);
    const hourlyRate = Number(staff.hourlyRate || (dailyRate > 0 ? dailyRate / requiredHours : 0));

    let isLate = false;
    let isLateAfterGrace = false;
    let penaltyHours = 0;
    let penaltyAmount = 0;

    try {
      let sHour = 9, sMin = 0;
      const isPM = /PM/i.test(shiftStartTime);
      const isAM = /AM/i.test(shiftStartTime);
      const cleanTime = shiftStartTime.replace(/\s*(AM|PM)\s*/i, '');
      const parts = cleanTime.split(':').map(Number);
      sHour = parts[0] || 0;
      sMin = parts[1] || 0;
      if (isPM && sHour < 12) sHour += 12;
      if (isAM && sHour === 12) sHour = 0;

      const shiftStartMins = sHour * 60 + sMin;
      const graceCutoffMins = shiftStartMins + leanTimeMinutes;

      const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const currentISTMins = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();

      // If arrived AFTER grace period, do NOT lock! Allow check-in to proceed, tag as Late After Grace, and apply flat ₹100 wage penalty.
      if (currentISTMins > graceCutoffMins) {
        isLate = true;
        isLateAfterGrace = true;
        penaltyHours = 1;
        penaltyAmount = 100;
      } else if (currentISTMins > shiftStartMins) {
        isLate = true;
      }
    } catch (err) {
      console.error('Shift timing check error:', err);
    }

    // 7. Handle check-in selfie if uploaded (file or base64 payload from camera)
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
    } else if (req.body.imageData && typeof req.body.imageData === 'string' && req.body.imageData.startsWith('data:image')) {
      // Direct base64 camera capture payload
      try {
        const base64Data = req.body.imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `attendance-cam-${Date.now()}-${Math.round(Math.random() * 1E9)}.jpg`;
        const uploadDir = path.join(__dirname, '../public/uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, buffer);
        
        const fileObj = {
          path: filePath,
          filename: filename,
          originalname: filename,
          mimetype: 'image/jpeg',
          size: buffer.length
        };
        const { syncToGridFS } = require('../utils/gridfs');
        const gfsFile = await syncToGridFS(fileObj);
        const protocol = req.protocol;
        const host = req.get('host');
        image = `${protocol}://${host}/uploads/${filename}`;
        if (gfsFile) {
          gridFsFileId = gfsFile._id;
          gridFsFilename = gfsFile.filename;
        }
      } catch (camErr) {
        console.error('Error saving base64 camera selfie:', camErr);
      }
    }

    const initialStatus = isLate ? 'Late' : 'Present';

    const newSession = {
      sessionNumber: currentShiftNumber,
      shiftLabel: currentShiftLabel,
      shiftStartTime,
      shiftEndTime,
      checkInTime: new Date(),
      checkOutTime: null,
      durationMinutes: 0,
      workingHours: 0,
      isLateAfterGrace,
      penaltyHours,
      penaltyAmount,
      sessionWage: 0,
      status: initialStatus,
      latitude: Number(latitude),
      longitude: Number(longitude),
      distanceFromCafe: Math.round(distance),
      deviceInfo: deviceInfo || 'Web Browser',
      image,
      cafeId: staff.cafeId,
      branchId: branch?.branchId || staff.assignedBranch || 'default'
    };

    const totalConfiguredShifts = (staff.scheduleType === 'SPLIT' && Array.isArray(staff.shifts) && staff.shifts.length > 0)
      ? staff.shifts.length
      : 1;
    const shiftWageAllocation = Number((dailyRate / totalConfiguredShifts).toFixed(2));

    let attendance;
    if (existingAttendance) {
      existingAttendance.shiftSessions.push(newSession);
      existingAttendance.activeSessionNumber = currentShiftNumber;
      existingAttendance.checkOutTime = null; // Unset root checkout so session is open
      if (isLateAfterGrace) existingAttendance.status = 'Late';
      existingAttendance.totalPenaltyAmount = (existingAttendance.totalPenaltyAmount || 0) + penaltyAmount;
      const completedWages = (existingAttendance.shiftSessions || [])
        .filter(s => !!s.checkOutTime)
        .reduce((sum, s) => sum + (s.sessionWage || 0), 0);
      existingAttendance.dailyWageEarned = Number((completedWages + shiftWageAllocation).toFixed(2));
      await existingAttendance.save();
      attendance = existingAttendance;
    } else {
      attendance = await Attendance.create({
        staffId,
        staffName: staff.name,
        branchId: branch.branchId,
        branchName: branch.branchId,
        cafeId: staff.cafeId,
        date: todayStr,
        checkInTime: new Date(),
        checkOutTime: null,
        latitude: Number(latitude),
        longitude: Number(longitude),
        distanceFromCafe: Math.round(distance),
        deviceInfo: deviceInfo || 'Web Browser',
        status: initialStatus,
        shiftStartTime,
        shiftEndTime,
        leanTimeMinutes,
        dailyWageRate: dailyRate,
        dailyWageEarned: shiftWageAllocation,
        isWageFinalized: false,
        image,
        gridFsFileId,
        gridFsFilename,
        shiftSessions: [newSession],
        activeSessionNumber: currentShiftNumber,
        totalPenaltyAmount: penaltyAmount
      });
    }

    const lateNotice = isLateAfterGrace 
      ? ` ⚠️ Late Check-In: Arrived after grace period. ₹${penaltyAmount} penalty will be deducted from this shift's wage.`
      : (isLate ? ' (Late Arrival within grace period).' : '');

    const msg = `Checked in for ${currentShiftLabel} successfully!${lateNotice}`;

    return res.status(201).json({
      success: true,
      message: msg,
      attendance,
      todayWageEarned: attendance.dailyWageEarned,
      shiftNumber: currentShiftNumber,
      isLateAfterGrace,
      penaltyAmount,
      staff: {
        id: staff._id,
        name: staff.name,
        dailyRate: staff.dailyRate !== undefined ? staff.dailyRate : 0,
        salaryType: staff.salaryType || 'DAILY',
        hourlyRate: staff.hourlyRate !== undefined ? staff.hourlyRate : 0,
        requiredHours: staff.requiredHours || 8,
        shiftStartTime,
        shiftEndTime,
        leanTimeMinutes,
        todayWageEarned: attendance.dailyWageEarned
      }
    });
  } catch (error) {
    console.error('checkIn error:', error);
    try {
      fs.appendFileSync(path.join(__dirname, '../debug_error.log'), `[${new Date().toISOString()}] checkIn error: ${error.stack || error.message}\n`);
    } catch (logErr) {}

    // Cleanup uploaded file if DB creation fails
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }

    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        message: 'An attendance record for today already exists for this staff member. Please refresh the page.' 
      });
    }

    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error processing check-in',
      details: error.stack
    });
  }
};

/**
 * Staff Check Out
 */
const checkOut = async (req, res) => {
  const { latitude, longitude, staffId: targetStaffId, employeeId, attendancePin } = req.body;
  let staffId = req.user._id;

  if (targetStaffId) {
    staffId = targetStaffId;
  } else if (employeeId) {
    const foundStaff = await User.findOne({ 
      employeeId: String(employeeId).trim(), 
      cafeId: req.user.cafeId || req.cafeId 
    });
    if (foundStaff) staffId = foundStaff._id;
  }

  try {
    const todayStr = getISTDate();
    // Find attendance record with an active open session
    const session = await Attendance.findOne({ 
      staffId, 
      date: todayStr,
      $or: [
        { activeSessionNumber: { $gt: 0 } },
        { checkOutTime: { $exists: false } },
        { checkOutTime: null }
      ]
    }).setOptions({ bypassBranchFilter: true }) || await Attendance.findOne({ staffId, checkOutTime: { $exists: false } }).setOptions({ bypassBranchFilter: true });

    if (!session) {
      return res.status(400).json({ success: false, message: 'No active check-in shift session found to clock out from.' });
    }

    const staff = await User.findById(staffId).setOptions({ bypassBranchFilter: true });

    // Verify 4-digit Attendance PIN (set by owner)
    if (staff && staff.attendancePin && staff.attendancePin.trim() !== '') {
      if (!attendancePin || String(attendancePin).trim() !== String(staff.attendancePin).trim()) {
        return res.status(400).json({ 
          success: false, 
          message: `Incorrect 4-digit Attendance PIN for ${staff.name}. Please enter the PIN set by the owner.` 
        });
      }
    } else if (staff && attendancePin && String(attendancePin).trim().length === 4) {
      staff.attendancePin = String(attendancePin).trim();
      await staff.save();
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

    // Identify active shift session in shiftSessions array
    const activeSession = (session.shiftSessions || []).find(s => !s.checkOutTime) ||
                          (session.shiftSessions && session.shiftSessions.length > 0 ? session.shiftSessions[session.shiftSessions.length - 1] : null);

    const sessionCheckInTime = activeSession?.checkInTime ? new Date(activeSession.checkInTime) : session.checkInTime;
    const diffMs = checkOutTime.getTime() - sessionCheckInTime.getTime();
    const sessionDurationMin = Math.max(1, Math.round(diffMs / 60000));
    const sessionWorkingHours = Number((sessionDurationMin / 60).toFixed(2));

    const dailyRate = Number(session.dailyWageRate || (staff ? staff.dailyRate : 0) || 0);
    const requiredHours = Number(staff?.requiredHours || 8);
    // Number of configured shifts for this staff
    const totalConfiguredShifts = (staff?.scheduleType === 'SPLIT' && Array.isArray(staff?.shifts) && staff.shifts.length > 0)
      ? staff.shifts.length
      : ((session.shiftSessions && session.shiftSessions.length > 1) ? session.shiftSessions.length : 1);

    // Equal wage allocated to each shift (e.g. ₹1000 / 2 = ₹500 per shift)
    const shiftWageAllocation = Number((dailyRate / totalConfiguredShifts).toFixed(2));

    // Target shift timing
    let targetShift = null;
    const activeShiftNum = activeSession?.sessionNumber || session.activeSessionNumber || 1;
    if (staff?.scheduleType === 'SPLIT' && Array.isArray(staff?.shifts) && staff.shifts.length > 0) {
      targetShift = staff.shifts.find(s => s.shiftNumber === activeShiftNum) ||
                    staff.shifts[activeShiftNum - 1] ||
                    staff.shifts[0];
    }
    const shiftStartTime = activeSession?.shiftStartTime || (targetShift && targetShift.startTime) || session.shiftStartTime || (staff && staff.shiftStartTime) || '09:00';
    const shiftEndTime = activeSession?.shiftEndTime || (targetShift && targetShift.endTime) || session.shiftEndTime || (staff && staff.shiftEndTime) || '18:00';
    let sM = parseTimeToMinutes(shiftStartTime) ?? (9 * 60);
    let eM = parseTimeToMinutes(shiftEndTime) ?? (18 * 60);
    if (eM <= sM) eM += 24 * 60;
    const scheduledShiftMin = Math.max(1, eM - sM);

    // Give full shift wage if completed shift (worked >= 60 mins, or stayed until shift end time):
    let sessionBaseWage = shiftWageAllocation;
    if (sessionDurationMin < 60 && sessionDurationMin < (scheduledShiftMin - 10)) {
      // Pro-rate only if left unusually early before 1 hour and before scheduled end
      sessionBaseWage = Number(Math.min(shiftWageAllocation, (sessionDurationMin / scheduledShiftMin) * shiftWageAllocation).toFixed(2));
    }

    // Apply late penalty deduction (flat ₹100) if arrived after grace period
    let penaltyDeduction = 0;
    if (activeSession?.isLateAfterGrace) {
      penaltyDeduction = activeSession.penaltyAmount || 100;
    }
    const sessionFinalWage = Math.max(0, Number((sessionBaseWage - penaltyDeduction).toFixed(2)));

    if (activeSession) {
      activeSession.checkOutTime = checkOutTime;
      activeSession.durationMinutes = sessionDurationMin;
      activeSession.workingHours = sessionWorkingHours;
      activeSession.sessionWage = sessionFinalWage;
      activeSession.status = activeSession.isLateAfterGrace ? 'Late' : 'Present';
    }

    // Sum across all completed shift sessions for today
    const completedList = (session.shiftSessions || []).filter(s => s.checkOutTime !== null && s.checkOutTime !== undefined);
    const totalDayDuration = completedList.reduce((acc, s) => acc + (s.durationMinutes || 0), 0) || sessionDurationMin;
    const totalDayWorkingHours = Number((totalDayDuration / 60).toFixed(2));
    const totalDayWages = completedList.length > 0 
      ? Number(completedList.reduce((acc, s) => acc + (s.sessionWage || 0), 0).toFixed(2))
      : sessionFinalWage;
    const totalDayPenalties = completedList.reduce((acc, s) => acc + (s.penaltyAmount || 0), 0);

    session.checkOutTime = checkOutTime;
    session.totalDuration = totalDayDuration;
    session.workingHours = totalDayWorkingHours;
    session.dailyWageEarned = totalDayWages;
    session.totalPenaltyAmount = totalDayPenalties;
    session.activeSessionNumber = 0;
    session.isWageFinalized = true;
    await session.save();

    const hours = Math.floor(sessionDurationMin / 60);
    const mins = sessionDurationMin % 60;

    const penaltyNotice = penaltyDeduction > 0 
      ? ` (Late Penalty: -₹${penaltyDeduction})` 
      : '';

    return res.status(200).json({
      success: true,
      message: `Checked out from ${activeSession?.shiftLabel || 'shift'} successfully! Duration: ${hours}h ${mins}m. Shift Earnings: ₹${sessionFinalWage}${penaltyNotice}. Total Day Wages: ₹${totalDayWages}`,
      attendance: session,
      finalizedWage: totalDayWages,
      sessionWage: sessionFinalWage,
      penaltyDeduction
    });
  } catch (error) {
    console.error('checkOut error:', error);
    try {
      fs.appendFileSync(path.join(__dirname, '../debug_error.log'), `[${new Date().toISOString()}] checkOut error: ${error.stack || error.message}\n`);
    } catch (logErr) {}
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Server error processing check-out',
      details: error.stack
    });
  }
};

/**
 * Get Today's Attendance for Current Staff
 */
const getTodayStatus = async (req, res) => {
  const { latitude, longitude, staffId: targetStaffId, employeeId } = req.query;
  let staffId = req.user._id;

  if (targetStaffId) {
    staffId = targetStaffId;
  } else if (employeeId) {
    const foundStaff = await User.findOne({ 
      employeeId: String(employeeId).trim(), 
      cafeId: req.user.cafeId || req.cafeId 
    });
    if (foundStaff) staffId = foundStaff._id;
  }

  const todayStr = getISTDate();

  try {
    const staff = await User.findById(staffId).setOptions({ bypassBranchFilter: true });
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

    // Check if there is an active session and apply auto-checkout if shift ended >= 5 mins ago
    let session = await Attendance.findOne({ 
      staffId, 
      date: todayStr,
      $or: [
        { activeSessionNumber: { $gt: 0 } },
        { checkOutTime: { $exists: false } },
        { checkOutTime: null }
      ]
    }).setOptions({ bypassBranchFilter: true }) || await Attendance.findOne({ staffId, checkOutTime: { $exists: false } }).setOptions({ bypassBranchFilter: true });

    if (session) {
      await checkAndApplyAutoCheckout(session, staff);
    }

    const attendance = await Attendance.findOne({ staffId, date: todayStr }).setOptions({ bypassBranchFilter: true });
    const todayWageEarned = attendance ? (attendance.dailyWageEarned || staff.dailyRate || 0) : 0;

    const SalaryHistory = require('../models/SalaryHistory');
    const [allStaffRecords, paidRecords] = await Promise.all([
      Attendance.find({ staffId }).lean(),
      SalaryHistory.find({ employeeId: staffId, paymentStatus: 'Paid' }).lean()
    ]);

    const liveTotalEarned = Number(allStaffRecords.reduce((sum, record) => {
      let wage = record.dailyWageEarned;
      if (wage === undefined || wage === null) {
        wage = (record.status === 'Half Day' ? (staff?.dailyRate || 0) * 0.5 : (staff?.dailyRate || 0));
      }
      return sum + Number(wage || 0);
    }, 0).toFixed(2));

    const liveTotalPaid = Number(paidRecords.reduce((sum, ph) => {
      const amt = ph.finalSalary !== undefined ? ph.finalSalary : (ph.paidAmount || ph.amountPaid || ph.amount || 0);
      return sum + Number(amt || 0);
    }, 0).toFixed(2));

    const liveRemainingBal = Math.max(0, Number((liveTotalEarned - liveTotalPaid).toFixed(2)));

    const activeSession = (attendance?.shiftSessions || []).find(s => !s.checkOutTime) || null;
    const isCurrentlyCheckedIn = !!activeSession || (attendance ? (attendance.activeSessionNumber > 0 || !attendance.checkOutTime) : false);
    const completedSessions = (attendance?.shiftSessions || []).filter(s => !!s.checkOutTime);
    const completedSessionsCount = completedSessions.length;
    const nextShiftNumber = Math.min(4, completedSessionsCount + 1);
    const canStartNextShift = !isCurrentlyCheckedIn && completedSessionsCount < 4;

    return res.status(200).json({
      success: true,
      checkedIn: !!attendance,
      checkedOut: attendance ? (!isCurrentlyCheckedIn && completedSessionsCount > 0) : false,
      isCurrentlyCheckedIn,
      canStartNextShift,
      nextShiftNumber,
      completedSessionsCount,
      shiftSessions: attendance?.shiftSessions || [],
      activeSession,
      currentShiftLabel: isCurrentlyCheckedIn 
        ? (activeSession?.shiftLabel || `Shift ${attendance?.activeSessionNumber || 1}`) 
        : `Shift ${nextShiftNumber}`,
      attendance,
      todayWageEarned,
      branchName,
      allowedRadius,
      distance: distance !== null ? Math.round(distance) : null,
      insideRadius,
      latitude: branchLat,
      longitude: branchLng,
      staff: {
        id: staff._id,
        name: staff.name,
        role: staff.role,
        dailyRate: staff.dailyRate !== undefined ? staff.dailyRate : 0,
        salaryType: staff.salaryType || 'DAILY',
        hourlyRate: staff.hourlyRate !== undefined ? staff.hourlyRate : 0,
        weeklyRate: staff.weeklyRate !== undefined ? staff.weeklyRate : 0,
        monthlyRate: staff.monthlyRate !== undefined ? staff.monthlyRate : 0,
        requiredHours: staff.requiredHours || 8,
        scheduleType: staff.scheduleType || 'SINGLE',
        shifts: staff.shifts || [],
        shiftStartTime: staff.shiftStartTime || '09:00',
        shiftEndTime: staff.shiftEndTime || '18:00',
        leanTimeMinutes: staff.leanTimeMinutes !== undefined ? staff.leanTimeMinutes : 30,
        todayWageEarned,
        totalEarnedAllTime: liveTotalEarned,
        totalPaidAllTime: liveTotalPaid,
        remainingSalaryBalance: liveRemainingBal
      }
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
  const staffId = req.query.staffId || req.user._id;
  const monthQuery = req.query.month; // e.g. '2026-10' or 'all'

  try {
    const staff = await User.findById(staffId).setOptions({ bypassBranchFilter: true });

    // Apply auto-checkout to any active session if shift ended >= 5 mins ago
    const activeSession = await Attendance.findOne({ 
      staffId, 
      $or: [{ activeSessionNumber: { $gt: 0 } }, { checkOutTime: { $exists: false } }, { checkOutTime: null }]
    }).setOptions({ bypassBranchFilter: true });
    if (activeSession) {
      await checkAndApplyAutoCheckout(activeSession, staff);
    }

    const SalaryHistory = require('../models/SalaryHistory');

    // Calculate monthly date boundaries based on IST
    const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const curYear = nowIST.getUTCFullYear();
    const curMonth = nowIST.getUTCMonth(); // 0-indexed
    const currentMonthPrefix = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
    const selectedMonthPrefix = monthQuery && monthQuery !== 'all' ? monthQuery : currentMonthPrefix;

    const [tYear, tMonth] = selectedMonthPrefix.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(tYear, tMonth - 1, 1, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(tYear, tMonth, 0, 23, 59, 59, 999));

    const isCurrentMonth = selectedMonthPrefix === currentMonthPrefix;
    const daysInSelectedMonth = new Date(tYear, tMonth, 0).getDate();
    const daysPassed = isCurrentMonth ? nowIST.getUTCDate() : daysInSelectedMonth;

    const dateFilter = monthQuery === 'all' 
      ? { staffId }
      : { 
          staffId, 
          $or: [
            { date: { $regex: `^${selectedMonthPrefix}` } },
            { checkInTime: { $gte: startOfMonth, $lte: endOfMonth } }
          ]
        };

    // Run history, wage totals, and payment queries in parallel
    const [history, allStaffRecords, paidRecords] = await Promise.all([
      Attendance.find(dateFilter).sort({ checkInTime: -1, date: -1 }).lean(),
      Attendance.find({ staffId }).select('dailyWageEarned status date checkInTime').lean(),
      SalaryHistory.find({
        employeeId: staffId,
        paymentStatus: 'Paid'
      }).select('finalSalary paidAmount amountPaid amount month paymentDate').lean()
    ]);

    // Unique present days in selected month
    const uniqueDatesPresent = new Set(history.map(r => r.date || (r.checkInTime ? new Date(r.checkInTime).toISOString().slice(0, 10) : '')));
    uniqueDatesPresent.delete('');
    const presentDaysCount = uniqueDatesPresent.size;
    const absentDays = Math.max(0, daysPassed - presentDaysCount);

    const totalWorkingMinutes = history.reduce((sum, record) => sum + (record.totalDuration || 0), 0);
    const totalHours = Number((totalWorkingMinutes / 60).toFixed(1));
    const lateCount = history.filter(r => r.status === 'Late').length;

    // Wage earned in this selected month
    const totalEarnedThisMonth = Number(history.reduce((sum, record) => {
      let wage = record.dailyWageEarned;
      if (wage === undefined || wage === null) {
        wage = (record.status === 'Half Day' ? (staff?.dailyRate || 0) * 0.5 : (staff?.dailyRate || 0));
      }
      return sum + Number(wage || 0);
    }, 0).toFixed(2));

    // Paid in this selected month
    const totalPaidThisMonth = Number(paidRecords.filter(ph => {
      if (ph.month && ph.month.startsWith(selectedMonthPrefix)) return true;
      if (ph.paymentDate) {
        const pDate = new Date(ph.paymentDate).toISOString().slice(0, 7);
        return pDate === selectedMonthPrefix;
      }
      return false;
    }).reduce((sum, ph) => {
      const amt = ph.finalSalary !== undefined ? ph.finalSalary : (ph.paidAmount || ph.amountPaid || ph.amount || 0);
      return sum + Number(amt || 0);
    }, 0).toFixed(2));

    const unpaidThisMonth = Math.max(0, Number((totalEarnedThisMonth - totalPaidThisMonth).toFixed(2)));

    // Calculate all-time earned vs paid
    const totalEarnedAllTime = Number(allStaffRecords.reduce((sum, record) => {
      let wage = record.dailyWageEarned;
      if (wage === undefined || wage === null) {
        wage = (record.status === 'Half Day' ? (staff?.dailyRate || 0) * 0.5 : (staff?.dailyRate || 0));
      }
      return sum + Number(wage || 0);
    }, 0).toFixed(2));

    const totalPaidAllTime = Number(paidRecords.reduce((sum, ph) => {
      const amt = ph.finalSalary !== undefined ? ph.finalSalary : (ph.paidAmount || ph.amountPaid || ph.amount || 0);
      return sum + Number(amt || 0);
    }, 0).toFixed(2));

    const unpaidSalaryBalance = Math.max(0, Number((totalEarnedAllTime - totalPaidAllTime).toFixed(2)));
    const attendancePercentage = Math.round((presentDaysCount / Math.max(1, daysPassed)) * 100);

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthDisplayName = `${monthNames[tMonth - 1] || ''} ${tYear}`;

    return res.status(200).json({
      success: true,
      history,
      selectedMonth: selectedMonthPrefix,
      monthDisplayName,
      summary: {
        totalWorkingHours: totalHours,
        attendancePercentage,
        lateDays: lateCount,
        presentDays: presentDaysCount,
        absentDays: absentDays,
        daysPassedInMonth: daysPassed,
        salaryEarnedThisMonth: totalEarnedThisMonth,
        paidThisMonth: totalPaidThisMonth,
        unpaidThisMonth: unpaidThisMonth,
        unpaidSalaryBalance: unpaidThisMonth,
        totalEarnedAllTime: totalEarnedAllTime,
        totalPaidAllTime: totalPaidAllTime
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
    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user?.role || '').toLowerCase());
    const queryBranch = req.query.branchId || req.headers['x-branch-id'];
    let activeBranch = 'default';
    if (isStaff && req.user?.assignedBranch) {
      activeBranch = req.user.assignedBranch;
    } else if (queryBranch) {
      activeBranch = queryBranch;
    } else if (req.branchId) {
      activeBranch = req.branchId;
    }

    const staffQuery = {
      cafeId,
      role: { $nin: ['super_admin', 'admin', 'owner', 'SUPER_ADMIN', 'ADMIN', 'OWNER'] },
      isActive: true
    };
    const attendanceQuery = { cafeId, date: todayStr };

    if (activeBranch !== 'all' && activeBranch !== '') {
      staffQuery.assignedBranch = activeBranch;
      attendanceQuery.branchId = activeBranch;
    }

    // Get all active staff members
    const staffList = await User.find(staffQuery);

    const todayRecords = await Attendance.find(attendanceQuery).lean();

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
      checkInTime: { $gte: startDate }
    };

    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user.role || '').toLowerCase());
    
    const staffQuery = {
      cafeId,
      role: { $nin: ['super_admin', 'admin', 'owner', 'SUPER_ADMIN', 'ADMIN', 'OWNER'] },
      isActive: true
    };

    if (isStaff && req.user.assignedBranch) {
      query.branchId = req.user.assignedBranch;
      staffQuery.assignedBranch = req.user.assignedBranch;
    } else if (activeBranch && activeBranch !== 'all' && activeBranch !== '') {
      query.branchId = activeBranch;
      staffQuery.assignedBranch = activeBranch;
    }

    const records = await Attendance.find(query).sort({ checkInTime: -1 }).lean();
    const staffCount = await User.countDocuments(staffQuery);

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
  const staffId = req.body.staffId || req.user._id;
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
      message: 'Extra work / overtime started successfully.',
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
  const staffId = req.body.staffId || req.user._id;
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

    const staff = await User.findById(staffId);
    const hourlyRate = (staff?.dailyRate || 500) / 8;
    const addedOvertimePay = Number((hourlyRate * overtimeHrs).toFixed(2));

    attendance.isExtraWorkActive = false;
    attendance.extraWorkEndTime = now;
    attendance.overtimeHours = Number(((attendance.overtimeHours || 0) + overtimeHrs).toFixed(2));
    attendance.overtimePay = Number(((attendance.overtimePay || 0) + addedOvertimePay).toFixed(2));
    attendance.dailyWageEarned = Number(((attendance.dailyWageEarned || 0) + addedOvertimePay).toFixed(2));
    await attendance.save();

    return res.status(200).json({
      success: true,
      message: `Extra work stopped successfully. Overtime added: ${overtimeHrs} hrs (+₹${addedOvertimePay}).`,
      attendance,
      overtimeHours: attendance.overtimeHours,
      finalWage: attendance.dailyWageEarned
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

/**
 * Get List of active staff members for Single-Device Kiosk Attendance
 */
const getKioskStaffList = async (req, res) => {
  try {
    const cafeId = req.user.cafeId || req.cafeId;
    const todayStr = getISTDate();

    // Determine active branch
    const isStaff = ['manager', 'chef', 'waiter', 'cashier', 'staff'].includes((req.user?.role || '').toLowerCase());
    const queryBranch = req.query.branchId || req.headers['x-branch-id'];
    let activeBranch = 'default';
    if (isStaff && req.user?.assignedBranch) {
      activeBranch = req.user.assignedBranch;
    } else if (queryBranch) {
      activeBranch = queryBranch;
    } else if (req.branchId) {
      activeBranch = req.branchId;
    }

    const query = { 
      cafeId, 
      isActive: true, 
      role: { $nin: ['superadmin', 'super_admin', 'admin', 'owner', 'SUPER_ADMIN', 'ADMIN', 'OWNER'] } 
    };

    if (activeBranch && activeBranch !== 'all') {
      query.assignedBranch = activeBranch;
    }

    const staffMembers = await User.find(query)
      .select('name employeeId staffRole role assignedBranch shiftStartTime shiftEndTime leanTimeMinutes dailyRate phone avatar attendancePin scheduleType shifts')
      .lean();

    const attendanceQuery = { cafeId, date: todayStr };
    if (activeBranch && activeBranch !== 'all') {
      attendanceQuery.branchId = activeBranch;
    }

    const SalaryHistory = require('../models/SalaryHistory');
    const staffIds = staffMembers.map(m => m._id);
    const [attendancesToday, allPaidRecords, allAttendances] = await Promise.all([
      Attendance.find(attendanceQuery),
      SalaryHistory.find({ employeeId: { $in: staffIds }, paymentStatus: 'Paid' }).lean(),
      Attendance.find({ staffId: { $in: staffIds } }).lean()
    ]);

    const paidMap = {};
    allPaidRecords.forEach(ph => {
      const eId = String(ph.employeeId);
      const amt = ph.finalSalary !== undefined ? ph.finalSalary : (ph.paidAmount || ph.amountPaid || ph.amount || 0);
      paidMap[eId] = (paidMap[eId] || 0) + Number(amt || 0);
    });

    const earnedMap = {};
    allAttendances.forEach(att => {
      const eId = String(att.staffId);
      const member = staffMembers.find(m => String(m._id) === eId);
      const rate = member ? (member.dailyRate || 0) : 0;
      let wage = att.dailyWageEarned;
      if (wage === undefined || wage === null) {
        wage = (att.status === 'Half Day' ? rate * 0.5 : rate);
      }
      earnedMap[eId] = (earnedMap[eId] || 0) + Number(wage || 0);
    });

    for (const att of attendancesToday) {
      if (!att.checkOutTime && !att.isExtraWorkActive) {
        const staffDoc = staffMembers.find(m => String(m._id) === String(att.staffId));
        await checkAndApplyAutoCheckout(att, staffDoc);
      }
    }

    const staffWithStatus = staffMembers.map(member => {
      const att = attendancesToday.find(a => String(a.staffId) === String(member._id));
      const sIdStr = String(member._id);
      const totalEarned = Number((earnedMap[sIdStr] || 0).toFixed(2));
      const totalPaid = Number((paidMap[sIdStr] || 0).toFixed(2));
      const remainingBal = Math.max(0, Number((totalEarned - totalPaid).toFixed(2)));

      return {
        _id: member._id,
        name: member.name,
        employeeId: member.employeeId || 'N/A',
        staffRole: member.staffRole || member.role || 'Staff',
        role: member.role || 'Staff',
        assignedBranch: member.assignedBranch || 'default',
        scheduleType: member.scheduleType || 'SINGLE',
        shifts: member.shifts || [],
        shiftStartTime: member.shiftStartTime || '09:00',
        shiftEndTime: member.shiftEndTime || '18:00',
        leanTimeMinutes: member.leanTimeMinutes !== undefined ? member.leanTimeMinutes : 30,
        dailyRate: member.dailyRate || 0,
        hasAttendancePin: Boolean(member.attendancePin && member.attendancePin.trim() !== ''),
        attendancePin: member.attendancePin || '',
        isCheckedIn: !!att,
        isCheckedOut: !!(att && att.checkOutTime),
        checkInTime: att ? att.checkInTime : null,
        checkOutTime: att ? att.checkOutTime : null,
        attendanceStatus: att ? att.status : 'Not Checked In',
        image: att ? att.image : '',
        remainingSalaryBalance: remainingBal,
        totalEarnedAllTime: totalEarned,
        totalPaidAllTime: totalPaid
      };
    });

    return res.status(200).json({
      success: true,
      branchId: activeBranch,
      staff: staffWithStatus
    });
  } catch (err) {
    console.error('getKioskStaffList error:', err);
    return res.status(500).json({ success: false, message: 'Server error retrieving kiosk staff roster' });
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
  editAttendance,
  getKioskStaffList,
  checkAndApplyAutoCheckout
};
