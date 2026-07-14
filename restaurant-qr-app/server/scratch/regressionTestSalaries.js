const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Cafe = require('../models/Cafe');
const Branch = require('../models/Branch');
const Payroll = require('../models/Payroll');
const SalaryHistory = require('../models/SalaryHistory');
const { recalculateStaffSalary } = require('../services/payrollService');

const getISTDate = (date = new Date()) => {
  const tzOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(date.getTime() + tzOffset);
  return istTime.toISOString().split('T')[0];
};

async function runRegressionTests() {
  console.log('========================================================');
  console.log('STARTING ENTERPRISE REGRESSION TESTS: STAFF SALARIES');
  console.log('========================================================');

  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const todayStr = getISTDate();
  
  // Calculate dates for past weeks
  const today = new Date(todayStr);
  
  // Week 1 (Current Week: Monday to Sunday)
  const current = new Date(todayStr);
  const day = current.getUTCDay();
  const diff = current.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday1 = new Date(current.setUTCDate(diff));
  const sunday1 = new Date(monday1);
  sunday1.setUTCDate(monday1.getUTCDate() + 6);
  const week1Start = monday1.toISOString().split('T')[0];
  const week1End = sunday1.toISOString().split('T')[0];

  // Week 2 (Previous Week: Monday to Sunday)
  const monday2 = new Date(monday1.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sunday2 = new Date(monday2);
  sunday2.setUTCDate(monday2.getUTCDate() + 6);
  const week2Start = monday2.toISOString().split('T')[0];
  const week2End = sunday2.toISOString().split('T')[0];

  console.log(`Week 1 Range (Current): ${week1Start} to ${week1End}`);
  console.log(`Week 2 Range (Previous): ${week2Start} to ${week2End}`);

  let testPassed = true;

  try {
    // -------------------------------------------------------------
    // SETUP MOCK DATA FOR ISOLATION TESTING (MULTIPLE CAFES & BRANCHES)
    // -------------------------------------------------------------
    console.log('\n--- Setting up isolation test data ---');
    
    // Cafe A
    const cafeA = new Cafe({ cafeId: 'REG_CAFE_A', name: 'Reg Cafe A', address: 'Cafe A Address', ownerEmail: 'owner.a@test.com' });
    const branchA1 = new Branch({ branchId: 'REG_BRANCH_A1', branchName: 'Branch A1', cafeId: 'REG_CAFE_A', address: 'A1 Address' });
    const branchA2 = new Branch({ branchId: 'REG_BRANCH_A2', branchName: 'Branch A2', cafeId: 'REG_CAFE_A', address: 'A2 Address' });
    
    // Cafe B
    const cafeB = new Cafe({ cafeId: 'REG_CAFE_B', name: 'Reg Cafe B', address: 'Cafe B Address', ownerEmail: 'owner.b@test.com' });
    const branchB1 = new Branch({ branchId: 'REG_BRANCH_B1', branchName: 'Branch B1', cafeId: 'REG_CAFE_B', address: 'B1 Address' });

    await cafeA.save();
    await branchA1.save();
    await branchA2.save();
    await cafeB.save();
    await branchB1.save();

    // Staff members
    const staffA1 = new User({
      name: 'Cafe A Branch 1 Staff', employeeId: 'REG_EMP_A1', role: 'staff',
      cafeId: 'REG_CAFE_A', assignedBranch: 'REG_BRANCH_A1', dailyRate: 1000, requiredHours: 8, phone: '9000000001'
    });
    const staffA2 = new User({
      name: 'Cafe A Branch 2 Staff', employeeId: 'REG_EMP_A2', role: 'staff',
      cafeId: 'REG_CAFE_A', assignedBranch: 'REG_BRANCH_A2', dailyRate: 1200, requiredHours: 8, phone: '9000000002'
    });
    const staffB1 = new User({
      name: 'Cafe B Branch 1 Staff', employeeId: 'REG_EMP_B1', role: 'staff',
      cafeId: 'REG_CAFE_B', assignedBranch: 'REG_BRANCH_B1', dailyRate: 1500, requiredHours: 8, phone: '9000000003'
    });

    await staffA1.save();
    await staffA2.save();
    await staffB1.save();

    // -------------------------------------------------------------
    // SCENARIO 1: VERIFY ISOLATION (NO DATA LEAKAGE)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 1: Verification of Cafe & Branch Isolation ---');

    // Create attendance for Staff A1 (Cafe A, Branch 1) on Week 1 Monday
    const attA1 = new Attendance({
      staffId: staffA1._id, staffName: staffA1.name, cafeId: staffA1.cafeId, branchId: staffA1.assignedBranch, branchName: 'Branch A1',
      date: week1Start, checkInTime: new Date(`${week1Start}T09:00:00Z`), checkOutTime: new Date(`${week1Start}T17:00:00Z`),
      totalDuration: 480, workingHours: 8, latitude: 1, longitude: 1, distanceFromCafe: 0, status: 'Present'
    });
    await attA1.save();

    // Create attendance for Staff B1 (Cafe B, Branch 1) on Week 1 Monday
    const attB1 = new Attendance({
      staffId: staffB1._id, staffName: staffB1.name, cafeId: staffB1.cafeId, branchId: staffB1.assignedBranch, branchName: 'Branch B1',
      date: week1Start, checkInTime: new Date(`${week1Start}T09:00:00Z`), checkOutTime: new Date(`${week1Start}T17:00:00Z`),
      totalDuration: 480, workingHours: 8, latitude: 1, longitude: 1, distanceFromCafe: 0, status: 'Present'
    });
    await attB1.save();

    // Verify isolation in queries
    const recordsCafeA = await Attendance.find({ cafeId: 'REG_CAFE_A' });
    const recordsCafeB = await Attendance.find({ cafeId: 'REG_CAFE_B' });
    const recordsBranchA1 = await Attendance.find({ cafeId: 'REG_CAFE_A', branchId: 'REG_BRANCH_A1' });
    const recordsBranchA2 = await Attendance.find({ cafeId: 'REG_CAFE_A', branchId: 'REG_BRANCH_A2' });

    console.log(`  Cafe A Records Count: ${recordsCafeA.length} (Expected: 1)`);
    console.log(`  Cafe B Records Count: ${recordsCafeB.length} (Expected: 1)`);
    console.log(`  Branch A1 Records Count: ${recordsBranchA1.length} (Expected: 1)`);
    console.log(`  Branch A2 Records Count: ${recordsBranchA2.length} (Expected: 0)`);

    if (recordsCafeA.length !== 1 || recordsCafeB.length !== 1 || recordsBranchA1.length !== 1 || recordsBranchA2.length !== 0) {
      console.error('  --> ISOLATION TEST FAILED! Data leakage detected.');
      testPassed = false;
    } else {
      console.log('  --> Cafe & Branch Isolation PASS!');
    }

    // -------------------------------------------------------------
    // SCENARIO 2: CALCULATION ACCURACY UNDER SCENARIOS (DAILY/WEEKLY/OT)
    // -------------------------------------------------------------
    console.log('\n--- Scenario 2: Calculation Accuracy Verification ---');

    const staffCalc = new User({
      name: 'Calculation Test Staff', employeeId: 'REG_EMP_CALC', role: 'staff',
      cafeId: 'REG_CAFE_A', assignedBranch: 'REG_BRANCH_A1', dailyRate: 1000, requiredHours: 8, phone: '9000000004'
    });
    await staffCalc.save();

    // 1. Full-Day Attendance: worked 8 hours (Expected salary = 1000)
    const attFull = new Attendance({
      staffId: staffCalc._id, staffName: staffCalc.name, cafeId: staffCalc.cafeId, branchId: staffCalc.assignedBranch, branchName: 'Branch A1',
      date: week1Start, checkInTime: new Date(`${week1Start}T09:00:00Z`), checkOutTime: new Date(`${week1Start}T17:00:00Z`),
      totalDuration: 480, workingHours: 8, latitude: 1, longitude: 1, distanceFromCafe: 0, status: 'Present'
    });
    await attFull.save();

    // 2. Half-Day Attendance: worked 4 hours (Expected salary = 500)
    // We place it on another day (Tuesday)
    const tuesdayStr = new Date(monday1.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const attHalf = new Attendance({
      staffId: staffCalc._id, staffName: staffCalc.name, cafeId: staffCalc.cafeId, branchId: staffCalc.assignedBranch, branchName: 'Branch A1',
      date: tuesdayStr, checkInTime: new Date(`${tuesdayStr}T09:00:00Z`), checkOutTime: new Date(`${tuesdayStr}T13:00:00Z`),
      totalDuration: 240, workingHours: 4, latitude: 1, longitude: 1, distanceFromCafe: 0, status: 'Half Day'
    });
    await attHalf.save();

    // 3. Overtime Attendance: worked 8 hours + 2 hours OT (Expected salary = 1000 + 250 = 1250)
    // We place it on Wednesday
    const wednesdayStr = new Date(monday1.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const attOT = new Attendance({
      staffId: staffCalc._id, staffName: staffCalc.name, cafeId: staffCalc.cafeId, branchId: staffCalc.assignedBranch, branchName: 'Branch A1',
      date: wednesdayStr, checkInTime: new Date(`${wednesdayStr}T09:00:00Z`), checkOutTime: new Date(`${wednesdayStr}T17:00:00Z`),
      totalDuration: 480, workingHours: 8, overtimeHours: 2, latitude: 1, longitude: 1, distanceFromCafe: 0, status: 'Present'
    });
    await attOT.save();

    // Fetch updated user to see recalculation results
    const userRec = await User.findById(staffCalc._id);
    const expectedWeekSalary = 1000 + 500 + 1250; // 2750

    console.log(`  Total Worked Hours This Week: ${userRec.actualWorkedHoursThisWeek} hrs (Expected: 20)`);
    console.log(`  Total Overtime Hours This Week: ${userRec.overtimeHoursThisWeek} hrs (Expected: 2)`);
    console.log(`  Weekly Salary Earned: ₹${userRec.salaryEarnedThisWeek} (Expected: ₹2750)`);

    if (userRec.salaryEarnedThisWeek !== expectedWeekSalary || userRec.actualWorkedHoursThisWeek !== 20 || userRec.overtimeHoursThisWeek !== 2) {
      console.error('  --> CALCULATION TEST FAILED!');
      testPassed = false;
    } else {
      console.log('  --> Calculation Accuracy PASS!');
    }

    // -------------------------------------------------------------
    // SCENARIO 3: MULTI-WEEK PAYROLL SEPARATION
    // -------------------------------------------------------------
    console.log('\n--- Scenario 3: Multi-Week Payroll Separation ---');

    // Create attendance logs for the previous week (Week 2)
    // Week 2 Monday: worked 8 hours
    const attWeek2 = new Attendance({
      staffId: staffCalc._id, staffName: staffCalc.name, cafeId: staffCalc.cafeId, branchId: staffCalc.assignedBranch, branchName: 'Branch A1',
      date: week2Start, checkInTime: new Date(`${week2Start}T09:00:00Z`), checkOutTime: new Date(`${week2Start}T17:00:00Z`),
      totalDuration: 480, workingHours: 8, latitude: 1, longitude: 1, distanceFromCafe: 0, status: 'Present'
    });
    await attWeek2.save();

    // Generate payroll for Week 2 (previous week)
    const { generateWeeklyPayroll } = require('../services/payrollService');
    const resultWeek2 = await generateWeeklyPayroll('REG_CAFE_A', 'REG_BRANCH_A1', week2Start, week2End, staffCalc._id);
    console.log(`  Generated payrolls for Week 2: ${resultWeek2.summary.generatedCount} records.`);

    // Generate payroll for Week 1 (current week)
    const resultWeek1 = await generateWeeklyPayroll('REG_CAFE_A', 'REG_BRANCH_A1', week1Start, week1End, staffCalc._id);
    console.log(`  Generated payrolls for Week 1: ${resultWeek1.summary.generatedCount} records.`);

    // Verify both payrolls exist
    const prWeek2 = await Payroll.findOne({ employeeId: staffCalc._id, weekStart: week2Start, weekEnd: week2End });
    const prWeek1 = await Payroll.findOne({ employeeId: staffCalc._id, weekStart: week1Start, weekEnd: week1End });

    console.log(`  Week 2 Payroll Net Salary: ₹${prWeek2 ? prWeek2.netSalary : 'N/A'} (Expected: ₹1000)`);
    console.log(`  Week 1 Payroll Net Salary: ₹${prWeek1 ? prWeek1.netSalary : 'N/A'} (Expected: ₹2750)`);

    if (!prWeek1 || !prWeek2 || prWeek2.netSalary !== 1000 || prWeek1.netSalary !== 2750) {
      console.error('  --> PAYROLL SEPARATION TEST FAILED!');
      testPassed = false;
    } else {
      console.log('  --> Multi-Week Payroll Separation PASS!');
    }

    // -------------------------------------------------------------
    // SCENARIO 4: STATUS TRANSITION & PERMANENT HISTORY RETENTION
    // -------------------------------------------------------------
    console.log('\n--- Scenario 4: Status Transition & Permanent History Retention ---');

    // 1. Approve Week 2 Payroll
    prWeek2.paymentStatus = 'Approved';
    await prWeek2.save();
    console.log(`  Payroll Week 2 Status: ${prWeek2.paymentStatus} (Expected: Approved)`);

    // 2. Mark Paid Week 2 Payroll
    const mockControllerParams = {
      params: { id: prWeek2._id },
      body: { paymentMethod: 'UPI', remarks: 'Paid via Regression Test' },
      user: { cafeId: 'REG_CAFE_A', assignedBranch: 'REG_BRANCH_A1', _id: staffCalc._id },
      headers: {},
      query: {}
    };
    
    // We mock payPayroll method execution
    const mockRes = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.responseData = data; return this; }
    };

    const { payPayroll: payPayrollController } = require('../controllers/payrollController');
    await payPayrollController(mockControllerParams, mockRes);

    const paidPayroll = await Payroll.findById(prWeek2._id);
    const hist = await SalaryHistory.findOne({ payrollId: prWeek2._id });

    console.log(`  Payroll Payment Status: ${paidPayroll.paymentStatus} (Expected: Paid)`);
    console.log(`  Permanent Salary History Record Created: ${hist ? 'Yes' : 'No'} (Expected: Yes)`);
    if (hist) {
      console.log(`    Payroll Week: ${hist.payrollWeek}`);
      console.log(`    Gross Salary: ₹${hist.grossSalary}`);
      console.log(`    Final Salary: ₹${hist.finalSalary}`);
      console.log(`    Payment Status: ${hist.paymentStatus}`);
      console.log(`    Payment Date: ${hist.paymentDate}`);
    }

    // 3. Verify history is not deletable
    const { deletePayroll: deletePayrollController } = require('../controllers/payrollController');
    const deleteParams = {
      params: { id: prWeek2._id },
      user: { cafeId: 'REG_CAFE_A', assignedBranch: 'REG_BRANCH_A1' },
      headers: {},
      query: {}
    };
    const deleteRes = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.responseData = data; return this; }
    };
    await deletePayrollController(deleteParams, deleteRes);
    console.log(`  Delete Paid Payroll Response Code: ${deleteRes.statusCode} (Expected: 400)`);

    if (paidPayroll.paymentStatus !== 'Paid' || !hist || deleteRes.statusCode !== 400) {
      console.error('  --> WORKFLOW & RETENTION TEST FAILED!');
      testPassed = false;
    } else {
      console.log('  --> Status Transition & Permanent History Retention PASS!');
    }

  } catch (err) {
    console.error('Error during regression testing:', err);
    testPassed = false;
  } finally {
    // -------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------
    console.log('\n--- Cleaning up test records ---');
    await Cafe.deleteMany({ cafeId: { $in: ['REG_CAFE_A', 'REG_CAFE_B'] } });
    await Branch.deleteMany({ branchId: { $in: ['REG_BRANCH_A1', 'REG_BRANCH_A2', 'REG_BRANCH_B1'] } });
    await User.deleteMany({ employeeId: { $in: ['REG_EMP_A1', 'REG_EMP_A2', 'REG_EMP_B1', 'REG_EMP_CALC'] } });
    
    // Find all users we created to clean up their attendances, payrolls, and history
    await Attendance.deleteMany({ cafeId: { $in: ['REG_CAFE_A', 'REG_CAFE_B'] } });
    await Payroll.deleteMany({ cafeId: { $in: ['REG_CAFE_A', 'REG_CAFE_B'] } });
    await SalaryHistory.deleteMany({ cafeId: { $in: ['REG_CAFE_A', 'REG_CAFE_B'] } });
    console.log('Cleanup complete.');
  }

  console.log('\n========================================================');
  if (testPassed) {
    console.log('REGRESSION STATUS: ALL AUDIT CHECKS PASSED ✅');
  } else {
    console.error('REGRESSION STATUS: AUDIT CHECKS FAILED ❌');
  }
  console.log('========================================================');

  await mongoose.connection.close();
}

runRegressionTests().catch(console.error);
