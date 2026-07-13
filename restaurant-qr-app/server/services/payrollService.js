const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');

const generateWeeklyPayroll = async (cafeId, branchId, weekStart, weekEnd, generatedBy) => {

  // 1. Fetch active employees belonging to this cafe AND this specific branch (excluding admins/owners to support future roles)
  const employees = await User.find({
    cafeId,
    role: { $nin: ['super_admin', 'admin', 'owner', 'SUPER_ADMIN', 'ADMIN', 'OWNER'] },
    isActive: true,
    assignedBranch: branchId
  });

  const payrolls = [];
  let generatedCount = 0;

  for (const emp of employees) {
    // Check if payroll already exists for this employee for this week range
    const existing = await Payroll.findOne({
      employeeId: emp._id,
      weekStart,
      weekEnd
    });
    if (existing) {
      continue; // Skip if already exists
    }

    // 2. Fetch all attendance records for this employee within week range
    const attendanceRecords = await Attendance.find({
      staffId: emp._id,
      cafeId,
      branchId,
      date: { $gte: weekStart, $lte: weekEnd }
    });

    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let workingHours = 0;
    let overtimeHours = 0;

    let basicSalary = 0;
    let halfDaySalary = 0;
    let overtimePay = 0;

    const baseDailyRate = emp.dailyRate || 0;
    const requiredHours = emp.requiredHours || 8;

    attendanceRecords.forEach(att => {
      if (att.status === 'Present') {
        presentDays += 1;
      } else if (att.status === 'Late') {
        presentDays += 1; // counts as present but recorded late
      } else if (att.status === 'Half Day') {
        halfDays += 1;
      } else if (att.status === 'Absent') {
        absentDays += 1;
      }
      
      const attWorkingHours = (att.totalDuration || 0) / 60;
      const attOvertimeHours = att.overtimeHours || 0;

      workingHours += attWorkingHours;
      overtimeHours += attOvertimeHours;

      // Salary = Daily Wage * Actual Hours Worked / Required Daily Hours
      const daySalary = (baseDailyRate * attWorkingHours) / requiredHours;
      const dayOvertimePay = (baseDailyRate * attOvertimeHours) / requiredHours;

      if (att.status === 'Half Day') {
        halfDaySalary += daySalary;
      } else {
        basicSalary += daySalary;
      }
      overtimePay += dayOvertimePay;
    });

    const netSalary = basicSalary + halfDaySalary + overtimePay;

    // Create payroll document
    const pr = await Payroll.create({
      cafeId,
      branchId,
      employeeId: emp._id,
      employeeName: emp.name,
      employeeRole: emp.staffRole || emp.role,
      weekStart,
      weekEnd,
      presentDays,
      absentDays,
      halfDays,
      workingHours: Number(workingHours.toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      salaryType: emp.salaryType || 'DAILY',
      dailyRate: baseDailyRate,
      requiredHours: requiredHours,
      hourlyRate: Number((baseDailyRate / requiredHours).toFixed(2)),
      weeklyRate: Number((baseDailyRate * 6).toFixed(2)),
      monthlyRate: Number((baseDailyRate * 26).toFixed(2)),
      basicSalary: Number(basicSalary.toFixed(2)),
      halfDaySalary: Number(halfDaySalary.toFixed(2)),
      overtimePay: Number(overtimePay.toFixed(2)),
      bonus: 0,
      deductions: 0,
      netSalary: Number(netSalary.toFixed(2)),
      paymentStatus: 'Pending'
    });

    payrolls.push(pr);
    generatedCount += 1;
  }

  return {
    summary: { generatedCount },
    payrolls
  };
};

module.exports = {
  generateWeeklyPayroll
};
