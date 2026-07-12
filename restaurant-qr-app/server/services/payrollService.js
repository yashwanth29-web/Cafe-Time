const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');

const generateWeeklyPayroll = async (cafeId, branchId, weekStart, weekEnd, generatedBy) => {

  // 1. Fetch active employees belonging to this cafe AND this specific branch
  const employees = await User.find({
    cafeId,
    role: { $in: ['staff', 'chef', 'manager', 'waiter', 'cashier'] },
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
      employeeId: emp._id,
      cafeId,
      branchId,
      date: { $gte: weekStart, $lte: weekEnd }
    });

    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let workingHours = 0;
    let overtimeHours = 0;

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
      
      workingHours += (att.totalDuration || 0) / 60;
      overtimeHours += att.overtimeHours || 0;
    });

    // 3. Basic salary calculations based on employee's salary type and rates
    let basicSalary = 0;
    let halfDaySalary = 0;
    let overtimePay = 0;

    const sType = emp.salaryType || 'DAILY';
    const baseDailyRate = emp.dailyRate || 0;
    const currentHourlyRate = Number((baseDailyRate / 8).toFixed(2));
    const currentWeeklyRate = Number((baseDailyRate * 6).toFixed(2));
    const currentMonthlyRate = Number((baseDailyRate * 26).toFixed(2));

    if (sType === 'DAILY') {
      basicSalary = presentDays * baseDailyRate;
      halfDaySalary = halfDays * baseDailyRate * 0.5;
      const otRate = currentHourlyRate;
      overtimePay = overtimeHours * otRate;
    } else if (sType === 'HOURLY') {
      basicSalary = workingHours * currentHourlyRate;
      halfDaySalary = 0;
      overtimePay = overtimeHours * currentHourlyRate;
    } else if (sType === 'WEEKLY') {
      basicSalary = currentWeeklyRate;
      halfDaySalary = 0;
      const otRate = currentHourlyRate;
      overtimePay = overtimeHours * otRate;
    } else if (sType === 'MONTHLY') {
      basicSalary = currentMonthlyRate / 4; // weekly share
      halfDaySalary = 0;
      const otRate = currentHourlyRate;
      overtimePay = overtimeHours * otRate;
    }

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
      salaryType: sType,
      dailyRate: baseDailyRate,
      hourlyRate: currentHourlyRate,
      weeklyRate: currentWeeklyRate,
      monthlyRate: currentMonthlyRate,
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
