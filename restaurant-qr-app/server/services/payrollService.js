const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');

const generateWeeklyPayroll = async (cafeId, weekStart, weekEnd, generatedBy) => {
  // Retrieve the branch context dynamically
  const { getContext } = require('../utils/context');
  const context = getContext();
  const branchId = (context && context.branchId) || 'default';

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
    if (sType === 'DAILY') {
      basicSalary = presentDays * (emp.dailyRate || 0);
      halfDaySalary = halfDays * (emp.dailyRate || 0) * 0.5;
      const otRate = emp.hourlyRate || ((emp.dailyRate || 0) / 8);
      overtimePay = overtimeHours * otRate;
    } else if (sType === 'HOURLY') {
      basicSalary = workingHours * (emp.hourlyRate || 0);
      halfDaySalary = 0;
      overtimePay = overtimeHours * (emp.hourlyRate || 0);
    } else if (sType === 'WEEKLY') {
      basicSalary = emp.weeklyRate || 0;
      halfDaySalary = 0;
      const otRate = emp.hourlyRate || ((emp.weeklyRate || 0) / 40);
      overtimePay = overtimeHours * otRate;
    } else if (sType === 'MONTHLY') {
      basicSalary = (emp.monthlyRate || 0) / 4; // weekly share
      halfDaySalary = 0;
      const otRate = emp.hourlyRate || ((emp.monthlyRate || 0) / 160);
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
      dailyRate: emp.dailyRate || 0,
      hourlyRate: emp.hourlyRate || 0,
      weeklyRate: emp.weeklyRate || 0,
      monthlyRate: emp.monthlyRate || 0,
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
