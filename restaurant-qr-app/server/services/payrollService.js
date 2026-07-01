const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Payroll = require('../models/Payroll');

/**
 * Helper: Generate all date strings in format YYYY-MM-DD between two dates
 */
const getDatesInRange = (startDateStr, endDateStr) => {
  const dates = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const current = new Date(start);

  while (current <= end) {
    const yyyy = current.getFullYear();
    const mm = String(current.getMonth() + 1).padStart(2, '0');
    const dd = String(current.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

/**
 * Helper: Get English day of week name from date string
 */
const getDayOfWeekName = (dateStr) => {
  const date = new Date(dateStr);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
};

/**
 * Calculate weekly payroll for a specific cafe and date range
 */
const generateWeeklyPayroll = async (cafeId, weekStart, weekEnd, generatedByUserId) => {
  if (!cafeId || !weekStart || !weekEnd) {
    throw new Error('cafeId, weekStart, and weekEnd are required');
  }

  // 1. Fetch active employees for this cafe
  const employees = await User.find({
    cafeId,
    role: { $in: ['staff', 'chef', 'manager', 'waiter', 'cashier', 'staff', 'chef', 'manager', 'waiter', 'cashier'].map(r => r.toLowerCase()) },
    isActive: true,
    salaryStatus: 'ACTIVE'
  });

  const rangeDates = getDatesInRange(weekStart, weekEnd);
  const summary = {
    totalEmployees: employees.length,
    generatedCount: 0,
    skippedCount: 0,
    totalPayrollAmount: 0
  };

  const results = [];

  for (const emp of employees) {
    // Check if payroll already exists for this employee in this week range to maintain idempotency
    const existing = await Payroll.findOne({
      employeeId: emp._id,
      weekStart,
      weekEnd
    });

    if (existing) {
      summary.skippedCount++;
      summary.totalPayrollAmount += existing.netSalary;
      results.push(existing);
      continue;
    }

    let presentDays = 0;
    let halfDays = 0;
    let leaveDays = 0;
    let absentDays = 0;
    let workingHours = 0;
    let overtimeHours = 0;

    // 2. Fetch all attendance records for this employee during the week
    const attendances = await Attendance.find({
      staffId: emp._id,
      date: { $in: rangeDates }
    });

    const attendanceMap = new Map();
    attendances.forEach(att => {
      attendanceMap.set(att.date, att);
    });

    // 3. Process each day in the weekly range
    for (const dateStr of rangeDates) {
      const att = attendanceMap.get(dateStr);

      if (att) {
        overtimeHours += att.overtimeHours || 0;
        workingHours += att.workingHours || ((att.totalDuration || 0) / 60);

        if (att.status === 'Leave') {
          leaveDays++;
        } else if (att.status === 'Holiday') {
          // Off day/Holiday, no deduct
        } else if (att.status === 'Half Day') {
          halfDays++;
        } else if (att.status === 'Absent') {
          absentDays++;
        } else if (att.status === 'Present' || att.status === 'Late') {
          // Check duration-based classifications if status is auto-generated
          const duration = att.totalDuration || 0;
          if (duration >= 480) { // 8 hours or more
            presentDays++;
          } else if (duration >= 240) { // 4 to 8 hours
            halfDays++;
          } else if (duration < 240 && duration > 0) {
            absentDays++;
          } else {
            presentDays++; // Standard default if checked in but duration not recorded (legacy fallback)
          }
        }
      } else {
        // No attendance record found for this day
        const dayName = getDayOfWeekName(dateStr);
        const isWeeklyOff = emp.weeklyOff && dayName.toLowerCase() === emp.weeklyOff.toLowerCase();

        if (isWeeklyOff) {
          // Weekly off is treated as a paid/holiday day off
        } else {
          // Unexcused absence
          absentDays++;
        }
      }
    }

    // 4. Calculate salary components based on salaryType
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
      overtimePay = overtimeHours * (emp.hourlyRate || 0);
    } else if (sType === 'WEEKLY') {
      basicSalary = emp.weeklyRate || 0;
      const otRate = emp.hourlyRate || ((emp.weeklyRate || 0) / 40);
      overtimePay = overtimeHours * otRate;
    } else if (sType === 'MONTHLY') {
      basicSalary = (emp.monthlyRate || 0) / 4; // weekly portion of monthly rate
      const otRate = emp.hourlyRate || ((emp.monthlyRate || 0) / 160);
      overtimePay = overtimeHours * otRate;
    }

    // Round values to 2 decimal places
    basicSalary = Number(basicSalary.toFixed(2));
    halfDaySalary = Number(halfDaySalary.toFixed(2));
    overtimePay = Number(overtimePay.toFixed(2));
    const netSalary = Number((basicSalary + halfDaySalary + overtimePay).toFixed(2));

    // Determine branchId (if staff has assignedBranch, use it)
    const branchId = emp.assignedBranch || '';

    // 5. Create immutable payroll snapshot
    const payroll = await Payroll.create({
      employeeId: emp._id,
      employeeName: emp.name,
      employeeRole: emp.staffRole || emp.role,
      cafeId,
      branchId,
      weekStart,
      weekEnd,
      presentDays,
      halfDays,
      leaveDays,
      absentDays,
      workingHours: Number(workingHours.toFixed(2)),
      overtimeHours: Number(overtimeHours.toFixed(2)),
      salaryType: sType,
      dailyRate: emp.dailyRate || 0,
      hourlyRate: emp.hourlyRate || 0,
      weeklyRate: emp.weeklyRate || 0,
      monthlyRate: emp.monthlyRate || 0,
      basicSalary,
      halfDaySalary,
      overtimePay,
      bonus: 0,
      deductions: 0,
      netSalary,
      paymentStatus: 'Pending',
      generatedBy: generatedByUserId
    });

    summary.generatedCount++;
    summary.totalPayrollAmount += netSalary;
    results.push(payroll);
  }

  summary.totalPayrollAmount = Number(summary.totalPayrollAmount.toFixed(2));
  return { summary, payrolls: results };
};

module.exports = {
  generateWeeklyPayroll
};
