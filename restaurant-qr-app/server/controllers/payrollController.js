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
    const result = await payrollService.generateWeeklyPayroll(cafeId, weekStart, weekEnd, req.user._id);

    // Create Notification for the Owner
    await Notification.create({
      userId: req.user._id,
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
    const query = {};

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
    const payroll = await Payroll.findById(id);
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found' });
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

  try {
    const payrolls = await Payroll.find({ employeeId: userId }).sort({ weekEnd: -1 });
    return res.status(200).json({ success: true, data: payrolls });
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
    const payroll = await Payroll.findOne({ _id: id, cafeId });
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found or does not belong to your cafe' });
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
    if (hourlyRate !== undefined) payroll.hourlyRate = Number(hourlyRate);
    if (weeklyRate !== undefined) payroll.weeklyRate = Number(weeklyRate);
    if (monthlyRate !== undefined) payroll.monthlyRate = Number(monthlyRate);

    // Recalculate basicSalary and overtimePay
    const sType = payroll.salaryType || 'DAILY';
    if (sType === 'DAILY') {
      payroll.basicSalary = payroll.presentDays * (payroll.dailyRate || 0);
      payroll.halfDaySalary = payroll.halfDays * (payroll.dailyRate || 0) * 0.5;
      const otRate = payroll.hourlyRate || ((payroll.dailyRate || 0) / 8);
      payroll.overtimePay = payroll.overtimeHours * otRate;
    } else if (sType === 'HOURLY') {
      payroll.basicSalary = payroll.workingHours * (payroll.hourlyRate || 0);
      payroll.halfDaySalary = 0;
      payroll.overtimePay = payroll.overtimeHours * (payroll.hourlyRate || 0);
    } else if (sType === 'WEEKLY') {
      payroll.basicSalary = payroll.weeklyRate || 0;
      payroll.halfDaySalary = 0;
      const otRate = payroll.hourlyRate || ((payroll.weeklyRate || 0) / 40);
      payroll.overtimePay = payroll.overtimeHours * otRate;
    } else if (sType === 'MONTHLY') {
      payroll.basicSalary = (payroll.monthlyRate || 0) / 4;
      payroll.halfDaySalary = 0;
      const otRate = payroll.hourlyRate || ((payroll.monthlyRate || 0) / 160);
      payroll.overtimePay = payroll.overtimeHours * otRate;
    }

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
    const payroll = await Payroll.findOne({ _id: id, cafeId });
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found or does not belong to your cafe' });
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
    const payroll = await Payroll.findOne({ _id: id, cafeId });
    if (!payroll) {
      return res.status(404).json({ success: false, message: 'Payroll record not found or does not belong to your cafe' });
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
    const query = { paymentStatus: 'Paid' };

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
    // 1. Total expenses vs pending
    const allRecords = await Payroll.find({ cafeId });

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
    const highestPaid = await Payroll.findOne({ cafeId }).sort({ netSalary: -1 }).limit(1);

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
