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

      // When attendance is marked, credit full day salary
      let daySalary = 0;
      if (att.status === 'Half Day') {
        daySalary = baseDailyRate * 0.5;
        halfDaySalary += daySalary;
      } else if (att.status === 'Present' || att.status === 'Late' || att.checkInTime) {
        daySalary = baseDailyRate;
        basicSalary += daySalary;
      } else if (att.status === 'Absent') {
        daySalary = 0;
      } else {
        daySalary = (baseDailyRate * attWorkingHours) / requiredHours;
        basicSalary += daySalary;
      }
      const dayOvertimePay = (baseDailyRate * attOvertimeHours) / requiredHours;
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

const recalculateStaffSalary = async (staffId) => {
  const User = require('../models/User');
  const Attendance = require('../models/Attendance');

  try {
    const user = await User.findById(staffId);
    if (!user) return;

    const getISTDate = (date = new Date()) => {
      const tzOffset = 5.5 * 60 * 60 * 1000;
      const istTime = new Date(date.getTime() + tzOffset);
      return istTime.toISOString().split('T')[0];
    };

    const todayStr = getISTDate();

    // Calculate current week's start (Monday) and end (Sunday) dates
    const current = new Date(todayStr);
    const day = current.getUTCDay();
    const diff = current.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(current.setUTCDate(diff));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);

    const weekStart = monday.toISOString().split('T')[0];
    const weekEnd = sunday.toISOString().split('T')[0];

    // Current month range
    const [currYear, currMonth] = todayStr.split('-').map(Number);
    const monthStart = `${currYear}-${String(currMonth).padStart(2, '0')}-01`;
    const lastDayOfMonth = new Date(currYear, currMonth, 0).getDate();
    const monthEnd = `${currYear}-${String(currMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`;

    const cafeId = user.cafeId || '';
    const branchId = user.assignedBranch || 'default';

    // 1. Fetch attendance records for today (active or completed)
    const todayRecord = await Attendance.findOne({
      staffId: user._id,
      cafeId,
      branchId,
      date: todayStr
    });

    // 2. Fetch attendance records for this week
    const weeklyRecords = await Attendance.find({
      staffId: user._id,
      cafeId,
      branchId,
      date: { $gte: weekStart, $lte: weekEnd }
    });

    // 3. Fetch attendance records for this month
    const monthlyRecords = await Attendance.find({
      staffId: user._id,
      cafeId,
      branchId,
      date: { $gte: monthStart, $lte: monthEnd }
    });

    const dailyRate = user.dailyRate || 0;
    const requiredHours = user.requiredHours || 8;

    // Calculate today's metrics
    let actualWorkedHoursToday = 0;
    let overtimeHoursToday = 0;
    let salaryEarnedToday = 0;

    if (todayRecord) {
      actualWorkedHoursToday = todayRecord.workingHours || 0;
      overtimeHoursToday = todayRecord.overtimeHours || 0;

      let regularSalary = 0;
      if (todayRecord.status === 'Half Day') {
        regularSalary = dailyRate * 0.5;
      } else if (todayRecord.status === 'Present' || todayRecord.status === 'Late' || todayRecord.checkInTime) {
        // Attendance marked -> Full day salary!
        regularSalary = dailyRate;
      } else if (todayRecord.status === 'Absent') {
        regularSalary = 0;
      } else {
        regularSalary = (dailyRate * actualWorkedHoursToday) / requiredHours;
      }
      const overtimeSalary = (dailyRate * overtimeHoursToday) / requiredHours;

      salaryEarnedToday = Number((regularSalary + overtimeSalary).toFixed(2));
    }

    // Calculate week's metrics
    let actualWorkedHoursThisWeek = 0;
    let overtimeHoursThisWeek = 0;
    let salaryEarnedThisWeek = 0;

    for (const record of weeklyRecords) {
      const recWorkHours = record.workingHours || 0;
      const recOtHours = record.overtimeHours || 0;

      actualWorkedHoursThisWeek += recWorkHours;
      overtimeHoursThisWeek += recOtHours;

      let regularSalary = 0;
      if (record.status === 'Half Day') {
        regularSalary = dailyRate * 0.5;
      } else if (record.status === 'Present' || record.status === 'Late' || record.checkInTime) {
        regularSalary = dailyRate;
      } else if (record.status === 'Absent') {
        regularSalary = 0;
      } else {
        regularSalary = (dailyRate * recWorkHours) / requiredHours;
      }
      const overtimeSalary = (dailyRate * recOtHours) / requiredHours;

      salaryEarnedThisWeek += regularSalary + overtimeSalary;
    }

    // Calculate month's metrics
    let actualWorkedHoursThisMonth = 0;
    let salaryEarnedThisMonth = 0;

    for (const record of monthlyRecords) {
      const recWorkHours = record.workingHours || 0;
      const recOtHours = record.overtimeHours || 0;

      actualWorkedHoursThisMonth += (recWorkHours + recOtHours);

      let regularSalary = 0;
      if (record.status === 'Half Day') {
        regularSalary = dailyRate * 0.5;
      } else if (record.status === 'Present' || record.status === 'Late' || record.checkInTime) {
        regularSalary = dailyRate;
      } else if (record.status === 'Absent') {
        regularSalary = 0;
      } else {
        regularSalary = (dailyRate * recWorkHours) / requiredHours;
      }
      const overtimeSalary = (dailyRate * recOtHours) / requiredHours;

      salaryEarnedThisMonth += regularSalary + overtimeSalary;
    }

    // Update staff member fields in the database
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          actualWorkedHoursToday: Number(actualWorkedHoursToday.toFixed(2)),
          overtimeHoursToday: Number(overtimeHoursToday.toFixed(2)),
          salaryEarnedToday: Number(salaryEarnedToday.toFixed(2)),
          actualWorkedHoursThisWeek: Number(actualWorkedHoursThisWeek.toFixed(2)),
          overtimeHoursThisWeek: Number(overtimeHoursThisWeek.toFixed(2)),
          salaryEarnedThisWeek: Number(salaryEarnedThisWeek.toFixed(2)),
          actualWorkedHoursThisMonth: Number(actualWorkedHoursThisMonth.toFixed(2)),
          salaryEarnedThisMonth: Number(salaryEarnedThisMonth.toFixed(2))
        }
      }
    );
  } catch (error) {
    console.error(`recalculateStaffSalary error for staff ${staffId}:`, error);
  }
};

module.exports = {
  generateWeeklyPayroll,
  recalculateStaffSalary
};
