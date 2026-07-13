const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Notification = require('../models/Notification');
const payrollService = require('../services/payrollService');

/**
 * Generate weekly payroll
 * POST /api/payroll/generate
 */
const generatePayroll = async (req, res) => {
  const { weekStart, weekEnd } = req.body;
  const cafeId = req.user.cafeId;

  if (!weekStart || !weekEnd) {
    return res.status(400).json({ success: false, message: 'weekStart and weekEnd dates are required (YYYY-MM-DD)' });
  }

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your admin profile does not have a cafe assignment' });
  }

  try {
    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || 'default';
    const result = await payrollService.generateWeeklyPayroll(cafeId, activeBranch, weekStart, weekEnd, req.user._id);

    // Create Notification for the Owner
    await Notification.create({
      userId: req.user._id,
      cafeId,
      branchId: activeBranch,
      title: 'Payroll Generated',
      message: `Weekly Payroll generated successfully for week ${weekStart} to ${weekEnd}. Generated ${result.summary.generatedCount} records.`
    });

    // Create Notifications for each employee whose payroll was newly generated
    for (const pr of result.payrolls) {
      // Find employee's user account
      const employeeUser = await User.findById(pr.employeeId);
      if (employeeUser) {
        await Notification.create({
          userId: employeeUser._id,
          cafeId,
          branchId: activeBranch,
          title: 'Weekly Payroll Ready',
          message: `Your payroll for the week ending on ${weekEnd} is ready. Net Salary: $${pr.netSalary}.`
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Weekly payroll generated successfully',
      summary: result.summary,
      payrolls: result.payrolls
    });
  } catch (error) {
    console.error('generatePayroll controller error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Payroll for one or more employees in this week range already exists.' });
    }
    return res.status(500).json({ success: false, message: error.message || 'Server error generating payroll' });
  }
};

/**
 * List payroll
 * GET /api/payroll
 */
const listPayroll = async (req, res) => {
  const cafeId = req.user.cafeId;
  const userRole = (req.user.role || '').toLowerCase();
  const userId = req.user._id;

  try {
    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';
    const query = { branchId: activeBranch };

    // Enforce role authorization filters
    if (userRole === 'admin' || userRole === 'owner' || userRole === 'manager') {
      if (!cafeId) {
        return res.status(400).json({ success: false, message: 'Your profile does not have a cafe assignment' });
      }
      query.cafeId = cafeId;
    } else {
      // Employee can only see their own payroll
      query.employeeId = userId;
    }

    // Apply filters if provided
    const { weekStart, weekEnd, paymentStatus, employeeId } = req.query;
    if (weekStart) query.weekStart = weekStart;
    if (weekEnd) query.weekEnd = weekEnd;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (employeeId && (userRole === 'admin' || userRole === 'owner' || userRole === 'manager')) {
      query.employeeId = employeeId;
    }

    const payrolls = await Payroll.find(query).sort({ weekEnd: -1, createdAt: -1 });
    return res.status(200).json({ success: true, count: payrolls.length, data: payrolls });
  } catch (error) {
    console.error('listPayroll error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving payroll records' });
  }
};

/**
 * Get Specific Payroll record Details
 * GET /api/payroll/:id
 */
const getPayrollDetails = async (req, res) => {
  const { id } = req.params;
  const cafeId = req.user.cafeId;
  const userRole = (req.user.role || '').toLowerCase();
  const userId = req.user._id;

  try {
    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';
    const payroll = await Payroll.findOne({ _id: id, branchId: activeBranch });
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found in this branch' });
    }

    // Check ownership scope
    if (userRole === 'admin' || userRole === 'owner' || userRole === 'manager') {
      if (payroll.cafeId !== cafeId) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to this cafe\'s payroll record' });
      }
    } else {
      if (payroll.employeeId.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to this payroll record' });
      }
    }

    return res.status(200).json({ success: true, data: payroll });
  } catch (error) {
    console.error('getPayrollDetails error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving payroll details' });
  }
};

/**
 * Get Current logged-in employee payroll history
 * GET /api/payroll/current
 */
const getCurrentEmployeePayroll = async (req, res) => {
  const userId = req.user._id;
  const user = req.user;

  try {
    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';
    const cafeId = req.user.cafeId || 'CD001';

    // 1. Calculate current week's start (Monday) and end (Sunday) dates
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekStartStr = monday.toISOString().split('T')[0];
    const weekEndStr = sunday.toISOString().split('T')[0];

    // 2. Fetch all attendance records for this employee within the current week range
    const Attendance = require('../models/Attendance');
    const attendanceRecords = await Attendance.find({
      staffId: userId,
      cafeId,
      branchId: activeBranch,
      date: { $gte: weekStartStr, $lte: weekEndStr }
    }).sort({ date: 1 }).lean();

    // 3. Perform calculations
    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let actualHoursWorked = 0;
    let overtimeHours = 0;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weeklyBreakdown = {
      'Monday': 0, 'Tuesday': 0, 'Wednesday': 0, 'Thursday': 0, 'Friday': 0, 'Saturday': 0, 'Sunday': 0
    };

    const formattedAttendances = attendanceRecords.map(att => {
      let durationMin = att.totalDuration || 0;
      if (!att.checkOutTime && att.checkInTime) {
        durationMin = Math.max(0, Math.floor((Date.now() - new Date(att.checkInTime).getTime()) / 60000));
      }
      
      const workingHours = Number((durationMin / 60).toFixed(2));
      const otHours = att.overtimeHours || 0;
      
      if (att.status === 'Present' || att.status === 'Late') {
        presentDays += 1;
      } else if (att.status === 'Half Day') {
        halfDays += 1;
      } else if (att.status === 'Absent') {
        absentDays += 1;
      }

      actualHoursWorked += workingHours;
      overtimeHours += otHours;

      // Calculate daily salary for this attendance
      const baseDailyRate = user.dailyRate || 0;
      const requiredHours = user.requiredHours || 8;

      let dailySalary = (baseDailyRate * (workingHours + otHours)) / requiredHours;
      dailySalary = Number(dailySalary.toFixed(2));
      
      const attDate = new Date(att.date || att.createdAt);
      const dayName = dayNames[attDate.getDay()];
      if (weeklyBreakdown.hasOwnProperty(dayName)) {
        weeklyBreakdown[dayName] = Number(((weeklyBreakdown[dayName] || 0) + dailySalary).toFixed(2));
      }

      return {
        date: att.date || new Date(att.createdAt).toISOString().split('T')[0],
        checkInTime: att.checkInTime,
        checkOutTime: att.checkOutTime,
        workingHours: Number((workingHours + otHours).toFixed(2)),
        dailySalary
      };
    });

    const currentWeekSalary = Object.values(weeklyBreakdown).reduce((sum, val) => sum + val, 0);

    const salaryData = {
      currentWeekSalary: Number(currentWeekSalary.toFixed(2)),
      weekStart: weekStartStr,
      weekEnd: weekEndStr,
      dailyRate: user.dailyRate || 0,
      requiredHours: user.requiredHours || 8,
      actualHoursWorked: Number((actualHoursWorked + overtimeHours).toFixed(2)),
      workingDays: presentDays + halfDays * 0.5,
      weeklyBreakdown,
      attendances: formattedAttendances
    };

    return res.status(200).json({ success: true, salaryData });
  } catch (error) {
    console.error('getCurrentEmployeePayroll error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving employee payroll history' });
  }
};

/**
 * Update Pending Payroll (Bonus, Deductions, Remarks)
 * PATCH /api/payroll/:id
 */
const updatePayroll = async (req, res) => {
  const { id } = req.params;
  const { 
    bonus, deductions, remarks,
    salaryType, dailyRate, hourlyRate, weeklyRate, monthlyRate 
  } = req.body;
  const cafeId = req.user.cafeId;

  try {
    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';
    const payroll = await Payroll.findOne({ _id: id, cafeId, branchId: activeBranch });
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found or does not belong to this branch' });
    }

    if (payroll.paymentStatus !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only Pending payrolls can be modified.' });
    }

    if (bonus !== undefined) {
      if (bonus < 0) return res.status(400).json({ success: false, message: 'Bonus cannot be negative' });
      payroll.bonus = Number(bonus);
    }

    if (deductions !== undefined) {
      if (deductions < 0) return res.status(400).json({ success: false, message: 'Deductions cannot be negative' });
      payroll.deductions = Number(deductions);
    }

    if (remarks !== undefined) {
      payroll.remarks = remarks.trim();
    }

    if (salaryType !== undefined) payroll.salaryType = salaryType;
    if (dailyRate !== undefined) payroll.dailyRate = Number(dailyRate);
    if (req.body.requiredHours !== undefined) payroll.requiredHours = Number(req.body.requiredHours);
    if (hourlyRate !== undefined) payroll.hourlyRate = Number(hourlyRate);
    if (weeklyRate !== undefined) payroll.weeklyRate = Number(weeklyRate);
    if (monthlyRate !== undefined) payroll.monthlyRate = Number(monthlyRate);

    // Recalculate basicSalary, halfDaySalary, and overtimePay using attendance-based formula
    const baseDailyRate = payroll.dailyRate || 0;
    const requiredHours = payroll.requiredHours || 8;

    payroll.hourlyRate = Number((baseDailyRate / requiredHours).toFixed(2));
    payroll.weeklyRate = Number((baseDailyRate * 6).toFixed(2));
    payroll.monthlyRate = Number((baseDailyRate * 26).toFixed(2));

    const halfDayHours = (payroll.halfDays || 0) * requiredHours * 0.5;
    const basicHours = Math.max(0, (payroll.workingHours || 0) - halfDayHours);

    payroll.basicSalary = (basicHours * baseDailyRate) / requiredHours;
    payroll.halfDaySalary = (halfDayHours * baseDailyRate) / requiredHours;
    payroll.overtimePay = ((payroll.overtimeHours || 0) * baseDailyRate) / requiredHours;

    // Round values to 2 decimal places
    payroll.basicSalary = Number(payroll.basicSalary.toFixed(2));
    payroll.halfDaySalary = Number(payroll.halfDaySalary.toFixed(2));
    payroll.overtimePay = Number(payroll.overtimePay.toFixed(2));

    // Recalculate Net Salary
    const calculatedNet = payroll.basicSalary + payroll.halfDaySalary + payroll.overtimePay + payroll.bonus - payroll.deductions;
    if (calculatedNet < 0) {
      return res.status(400).json({ success: false, message: 'Net Salary cannot be negative. Check deductions.' });
    }
    payroll.netSalary = Number(calculatedNet.toFixed(2));

    await payroll.save();

    return res.status(200).json({
      success: true,
      message: 'Payroll record updated successfully.',
      data: payroll
    });
  } catch (error) {
    console.error('updatePayroll error:', error);
    return res.status(500).json({ success: false, message: 'Server error updating payroll' });
  }
};

/**
 * Mark Salary Paid
 * PATCH /api/payroll/:id/pay
 */
const payPayroll = async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, remarks } = req.body;
  const cafeId = req.user.cafeId;

  if (!paymentMethod) {
    return res.status(400).json({ success: false, message: 'paymentMethod is required' });
  }

  try {
    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';
    const payroll = await Payroll.findOne({ _id: id, cafeId, branchId: activeBranch });
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found or does not belong to this branch' });
    }

    if (payroll.paymentStatus === 'Paid') {
      return res.status(400).json({ success: false, message: 'Salary is already marked as Paid.' });
    }

    payroll.paymentStatus = 'Paid';
    payroll.paidBy = req.user._id;
    payroll.paymentMethod = paymentMethod;
    payroll.paymentDate = new Date();
    if (remarks !== undefined) payroll.remarks = remarks;

    await payroll.save();

    // Create Notification for the Employee
    await Notification.create({
      userId: payroll.employeeId,
      cafeId: payroll.cafeId || cafeId,
      branchId: payroll.branchId || activeBranch,
      title: 'Salary Disbursed',
      message: `Your salary of $${payroll.netSalary} for the week ${payroll.weekStart} to ${payroll.weekEnd} has been paid via ${paymentMethod}.`
    });

    return res.status(200).json({
      success: true,
      message: 'Salary marked as Paid successfully',
      data: payroll
    });
  } catch (error) {
    console.error('payPayroll error:', error);
    return res.status(500).json({ success: false, message: 'Server error marking salary paid' });
  }
};

/**
 * Delete Pending Payroll (Only)
 * DELETE /api/payroll/:id
 */
const deletePayroll = async (req, res) => {
  const { id } = req.params;
  const cafeId = req.user.cafeId;

  try {
    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';
    const payroll = await Payroll.findOne({ _id: id, cafeId, branchId: activeBranch });
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found or does not belong to this branch' });
    }

    if (payroll.paymentStatus !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Only PENDING payroll records can be deleted.' });
    }

    await Payroll.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: 'Pending payroll record deleted successfully.'
    });
  } catch (error) {
    console.error('deletePayroll error:', error);
    return res.status(500).json({ success: false, message: 'Server error deleting payroll record' });
  }
};

/**
 * Get Payroll History (Paid records)
 * GET /api/payroll/history
 */
const getPayrollHistory = async (req, res) => {
  const cafeId = req.user.cafeId;
  const userRole = (req.user.role || '').toLowerCase();
  const userId = req.user._id;

  try {
    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';
    const query = { paymentStatus: 'Paid', branchId: activeBranch };

    if (userRole === 'admin' || userRole === 'owner' || userRole === 'manager') {
      if (!cafeId) {
        return res.status(400).json({ success: false, message: 'Your profile does not have a cafe assignment' });
      }
      query.cafeId = cafeId;
    } else {
      query.employeeId = userId;
    }

    const history = await Payroll.find(query).sort({ paymentDate: -1 });
    return res.status(200).json({ success: true, count: history.length, data: history });
  } catch (error) {
    console.error('getPayrollHistory error:', error);
    return res.status(500).json({ success: false, message: 'Server error fetching payroll history' });
  }
};

/**
 * Get Payroll Reports data
 * GET /api/payroll/report
 */
const getPayrollReport = async (req, res) => {
  const cafeId = req.user.cafeId;

  if (!cafeId) {
    return res.status(400).json({ success: false, message: 'Your profile does not have a cafe assignment' });
  }

  try {
    const activeBranch = req.headers['x-branch-id'] || req.query.branchId || req.user.assignedBranch || req.branchId || 'default';
    // 1. Total expenses vs pending
    const allRecords = await Payroll.find({ cafeId, branchId: activeBranch });

    let totalPaid = 0;
    let totalPending = 0;
    let totalDeductions = 0;
    let totalBonus = 0;

    allRecords.forEach(r => {
      if (r.paymentStatus === 'Paid') {
        totalPaid += r.netSalary;
      } else if (r.paymentStatus === 'Pending') {
        totalPending += r.netSalary;
      }
      totalDeductions += r.deductions || 0;
      totalBonus += r.bonus || 0;
    });

    // 2. Highest paid employee
    const highestPaid = await Payroll.findOne({ cafeId, branchId: activeBranch }).sort({ netSalary: -1 }).limit(1);

    // 3. Branch wise expenses breakdown
    const branchBreakdown = {};
    allRecords.forEach(r => {
      const bKey = r.branchId || 'main';
      if (!branchBreakdown[bKey]) {
        branchBreakdown[bKey] = {
          branchId: bKey,
          totalPaid: 0,
          totalPending: 0,
          totalNet: 0
        };
      }
      if (r.paymentStatus === 'Paid') {
        branchBreakdown[bKey].totalPaid += r.netSalary;
      } else {
        branchBreakdown[bKey].totalPending += r.netSalary;
      }
      branchBreakdown[bKey].totalNet += r.netSalary;
    });

    // 4. Employee wise summary
    const employeeSummary = {};
    allRecords.forEach(r => {
      const empId = r.employeeId.toString();
      if (!employeeSummary[empId]) {
        employeeSummary[empId] = {
          name: r.employeeName,
          role: r.employeeRole,
          totalEarned: 0,
          recordsCount: 0
        };
      }
      employeeSummary[empId].totalEarned += r.netSalary;
      employeeSummary[empId].recordsCount += 1;
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalPaid: Number(totalPaid.toFixed(2)),
        totalPending: Number(totalPending.toFixed(2)),
        totalDeductions: Number(totalDeductions.toFixed(2)),
        totalBonus: Number(totalBonus.toFixed(2)),
        highestPaidEmployee: highestPaid ? {
          name: highestPaid.employeeName,
          salary: highestPaid.netSalary,
          role: highestPaid.employeeRole
        } : null
      },
      branchReports: Object.values(branchBreakdown),
      employeeReports: Object.values(employeeSummary)
    });
  } catch (error) {
    console.error('getPayrollReport error:', error);
    return res.status(500).json({ success: false, message: 'Server error generating payroll reports' });
  }
};

module.exports = {
  generatePayroll,
  listPayroll,
  getPayrollDetails,
  getCurrentEmployeePayroll,
  updatePayroll,
  payPayroll,
  deletePayroll,
  getPayrollHistory,
  getPayrollReport
};
