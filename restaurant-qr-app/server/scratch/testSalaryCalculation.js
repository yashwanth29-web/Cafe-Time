const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Attendance = require('../models/Attendance');
const Cafe = require('../models/Cafe');
const Branch = require('../models/Branch');
const { recalculateStaffSalary } = require('../services/payrollService');

const getISTDate = (date = new Date()) => {
  const tzOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(date.getTime() + tzOffset);
  return istTime.toISOString().split('T')[0];
};

async function test() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const todayStr = getISTDate();
  
  // Calculate yesterday's date string
  const yesterday = new Date(todayStr);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  console.log(`Testing with date: Today = ${todayStr}, Yesterday = ${yesterdayStr}`);

  // Create mock Cafes
  const existingCafe = new Cafe({ cafeId: 'TEST_CAFE_EXISTING', name: 'Existing Cafe', address: '123 Main St', ownerEmail: 'owner@existing.com' });
  const newCafe = new Cafe({ cafeId: 'TEST_CAFE_NEW', name: 'New Cafe', address: '456 New Rd', ownerEmail: 'owner@new.com' });
  await existingCafe.save();
  await newCafe.save();

  // Create mock Branches
  const existingBranch = new Branch({ branchId: 'TEST_BRANCH_EXISTING', branchName: 'Existing Branch', cafeId: 'TEST_CAFE_EXISTING', address: '123 Branch St' });
  const newBranch = new Branch({ branchId: 'TEST_BRANCH_NEW', branchName: 'New Branch', cafeId: 'TEST_CAFE_NEW', address: '456 Branch Rd' });
  await existingBranch.save();
  await newBranch.save();

  // Create mock Staff
  const staff1 = new User({
    name: 'Full Day Staff',
    phone: '1111111111',
    role: 'staff',
    staffRole: 'Barista',
    employeeId: 'EMP_FULL_DAY',
    cafeId: 'TEST_CAFE_EXISTING',
    assignedBranch: 'TEST_BRANCH_EXISTING',
    dailyRate: 1000,
    requiredHours: 8
  });

  const staff2 = new User({
    name: 'Half Day Staff',
    phone: '2222222222',
    role: 'staff',
    staffRole: 'Cashier',
    employeeId: 'EMP_HALF_DAY',
    cafeId: 'TEST_CAFE_EXISTING',
    assignedBranch: 'TEST_BRANCH_EXISTING',
    dailyRate: 1200,
    requiredHours: 8
  });

  const staff3 = new User({
    name: 'Absent Staff',
    phone: '3333333333',
    role: 'staff',
    staffRole: 'Cleaner',
    employeeId: 'EMP_ABSENT',
    cafeId: 'TEST_CAFE_EXISTING',
    assignedBranch: 'TEST_BRANCH_EXISTING',
    dailyRate: 800,
    requiredHours: 8
  });

  const staff4 = new User({
    name: 'Multi Day Staff',
    phone: '4444444444',
    role: 'staff',
    staffRole: 'Chef',
    employeeId: 'EMP_MULTI_DAY',
    cafeId: 'TEST_CAFE_EXISTING',
    assignedBranch: 'TEST_BRANCH_EXISTING',
    dailyRate: 1500,
    requiredHours: 8
  });

  const staffNewCafe = new User({
    name: 'New Cafe Staff',
    phone: '5555555555',
    role: 'staff',
    staffRole: 'Waiter',
    employeeId: 'EMP_NEW_CAFE',
    cafeId: 'TEST_CAFE_NEW',
    assignedBranch: 'TEST_BRANCH_NEW',
    dailyRate: 1000,
    requiredHours: 8
  });

  await staff1.save();
  await staff2.save();
  await staff3.save();
  await staff4.save();
  await staffNewCafe.save();

  // Create mock Attendance Logs
  // 1. Staff 1: Full day (worked 8 hours, status Present)
  const att1 = new Attendance({
    staffId: staff1._id,
    staffName: staff1.name,
    branchId: staff1.assignedBranch,
    branchName: 'Existing Branch',
    cafeId: staff1.cafeId,
    date: todayStr,
    checkInTime: new Date(new Date().setUTCHours(9, 0, 0, 0)),
    checkOutTime: new Date(new Date().setUTCHours(17, 0, 0, 0)),
    totalDuration: 480,
    workingHours: 8,
    overtimeHours: 2, // 2 hours overtime
    latitude: 12.9716,
    longitude: 77.5946,
    distanceFromCafe: 10,
    status: 'Present'
  });

  // 2. Staff 2: Half day (worked 4 hours, status Half Day)
  const att2 = new Attendance({
    staffId: staff2._id,
    staffName: staff2.name,
    branchId: staff2.assignedBranch,
    branchName: 'Existing Branch',
    cafeId: staff2.cafeId,
    date: todayStr,
    checkInTime: new Date(new Date().setUTCHours(9, 0, 0, 0)),
    checkOutTime: new Date(new Date().setUTCHours(13, 0, 0, 0)),
    totalDuration: 240,
    workingHours: 4,
    overtimeHours: 0,
    latitude: 12.9716,
    longitude: 77.5946,
    distanceFromCafe: 10,
    status: 'Half Day'
  });

  // 3. Staff 4: Multiple attendance records (yesterday and today)
  // Yesterday: worked 8 hours
  const att4_1 = new Attendance({
    staffId: staff4._id,
    staffName: staff4.name,
    branchId: staff4.assignedBranch,
    branchName: 'Existing Branch',
    cafeId: staff4.cafeId,
    date: yesterdayStr,
    checkInTime: new Date(new Date(yesterday).setUTCHours(9, 0, 0, 0)),
    checkOutTime: new Date(new Date(yesterday).setUTCHours(17, 0, 0, 0)),
    totalDuration: 480,
    workingHours: 8,
    overtimeHours: 1, // 1 hour overtime yesterday
    latitude: 12.9716,
    longitude: 77.5946,
    distanceFromCafe: 10,
    status: 'Present'
  });

  // Today: worked 6 hours
  const att4_2 = new Attendance({
    staffId: staff4._id,
    staffName: staff4.name,
    branchId: staff4.assignedBranch,
    branchName: 'Existing Branch',
    cafeId: staff4.cafeId,
    date: todayStr,
    checkInTime: new Date(new Date().setUTCHours(9, 0, 0, 0)),
    checkOutTime: new Date(new Date().setUTCHours(15, 0, 0, 0)),
    totalDuration: 360,
    workingHours: 6,
    overtimeHours: 0,
    latitude: 12.9716,
    longitude: 77.5946,
    distanceFromCafe: 10,
    status: 'Present'
  });

  // 4. Staff at New Cafe: worked 8 hours today
  const attNewCafe = new Attendance({
    staffId: staffNewCafe._id,
    staffName: staffNewCafe.name,
    branchId: staffNewCafe.assignedBranch,
    branchName: 'New Branch',
    cafeId: staffNewCafe.cafeId,
    date: todayStr,
    checkInTime: new Date(new Date().setUTCHours(9, 0, 0, 0)),
    checkOutTime: new Date(new Date().setUTCHours(17, 0, 0, 0)),
    totalDuration: 480,
    workingHours: 8,
    overtimeHours: 0,
    latitude: 12.9716,
    longitude: 77.5946,
    distanceFromCafe: 10,
    status: 'Present'
  });

  // Save attendance (which will fire our Mongoose hooks and recalculate salaries!)
  console.log('Saving attendance logs...');
  await att1.save();
  await att2.save();
  await att4_1.save();
  await att4_2.save();
  await attNewCafe.save();
  console.log('Attendance logs saved and recalculations completed via hooks.');

  // Explicit recalculation for Staff 3 (who has no attendance records today or this week)
  console.log('Recalculating for Absent Staff...');
  await recalculateStaffSalary(staff3._id);

  // Fetch updated users
  const u1 = await User.findById(staff1._id);
  const u2 = await User.findById(staff2._id);
  const u3 = await User.findById(staff3._id);
  const u4 = await User.findById(staff4._id);
  const uNew = await User.findById(staffNewCafe._id);

  console.log('\n====================================');
  console.log('VALIDATING SALARY CALCULATION VALUES');
  console.log('====================================');

  let passed = true;

  // 1. Validate Staff 1 (Full Day + Overtime)
  // Daily wage = 1000. Required hours = 8. worked today = 8. Overtime = 2.
  // Today salary expected: 1000 (regular) + 2 * (1000 / 8) = 1000 + 250 = 1250.
  // Weekly expected: 1250 (since only one record this week so far).
  console.log('\n[Staff 1 - Full Day + Overtime]');
  console.log(`  Actual Worked Hours Today: ${u1.actualWorkedHoursToday} hrs (Expected: 8)`);
  console.log(`  Overtime Hours Today: ${u1.overtimeHoursToday} hrs (Expected: 2)`);
  console.log(`  Salary Earned Today: ₹${u1.salaryEarnedToday} (Expected: ₹1250)`);
  console.log(`  Salary Earned This Week: ₹${u1.salaryEarnedThisWeek} (Expected: ₹1250)`);
  if (u1.salaryEarnedToday !== 1250 || u1.salaryEarnedThisWeek !== 1250) {
    console.error('  --> FAIL!');
    passed = false;
  } else {
    console.log('  --> PASS!');
  }

  // 2. Validate Staff 2 (Half Day: 4 hrs / 8 hrs)
  // Daily wage = 1200. Required hours = 8. worked today = 4.
  // Today salary expected: 1200 * (4 / 8) = 600.
  console.log('\n[Staff 2 - Half Day]');
  console.log(`  Actual Worked Hours Today: ${u2.actualWorkedHoursToday} hrs (Expected: 4)`);
  console.log(`  Salary Earned Today: ₹${u2.salaryEarnedToday} (Expected: ₹600)`);
  console.log(`  Salary Earned This Week: ₹${u2.salaryEarnedThisWeek} (Expected: ₹600)`);
  if (u2.salaryEarnedToday !== 600 || u2.salaryEarnedThisWeek !== 600) {
    console.error('  --> FAIL!');
    passed = false;
  } else {
    console.log('  --> PASS!');
  }

  // 3. Validate Staff 3 (Absent Staff)
  // Expected values should be 0.
  console.log('\n[Staff 3 - Absent]');
  console.log(`  Actual Worked Hours Today: ${u3.actualWorkedHoursToday} hrs (Expected: 0)`);
  console.log(`  Salary Earned Today: ₹${u3.salaryEarnedToday} (Expected: ₹0)`);
  console.log(`  Salary Earned This Week: ₹${u3.salaryEarnedThisWeek} (Expected: ₹0)`);
  if (u3.salaryEarnedToday !== 0 || u3.salaryEarnedThisWeek !== 0) {
    console.error('  --> FAIL!');
    passed = false;
  } else {
    console.log('  --> PASS!');
  }

  // 4. Validate Staff 4 (Multiple Attendance Records - yesterday and today)
  // Daily Rate = 1500. Req Hours = 8.
  // Yesterday: worked 8 hrs, 1 hr OT. Salary = 1500 + 1 * (1500/8) = 1500 + 187.5 = 1687.5
  // Today: worked 6 hrs, 0 hr OT. Salary = 1500 * (6/8) = 1125.
  // Today Salary Expected: ₹1125
  // Weekly Salary Expected: 1687.5 + 1125 = 2812.5 (assuming yesterday is in the same week, let's verify if yesterday is same week. Monday to Sunday. If today is Monday, yesterday Sunday (0) is previous week. Let's write the checks dynamically)
  console.log('\n[Staff 4 - Multi Day]');
  console.log(`  Actual Worked Hours Today: ${u4.actualWorkedHoursToday} hrs (Expected: 6)`);
  console.log(`  Salary Earned Today: ₹${u4.salaryEarnedToday} (Expected: ₹1125)`);
  console.log(`  Salary Earned This Week: ₹${u4.salaryEarnedThisWeek}`);
  
  // Let's determine if yesterday was in the same week as today
  const current = new Date(todayStr);
  const day = current.getUTCDay();
  const isYesterdaySameWeek = day !== 1; // if today is Monday (1), yesterday Sunday (0) is previous week.
  const expectedWeekly = isYesterdaySameWeek ? (1687.5 + 1125) : 1125;
  console.log(`  Expected Weekly: ₹${expectedWeekly} (Is yesterday same week: ${isYesterdaySameWeek})`);
  
  if (u4.salaryEarnedToday !== 1125 || u4.salaryEarnedThisWeek !== expectedWeekly) {
    console.error('  --> FAIL!');
    passed = false;
  } else {
    console.log('  --> PASS!');
  }

  // 5. Validate Staff in New Cafe/New Branch
  console.log('\n[Staff New Cafe / New Branch]');
  console.log(`  Actual Worked Hours Today: ${uNew.actualWorkedHoursToday} hrs (Expected: 8)`);
  console.log(`  Salary Earned Today: ₹${uNew.salaryEarnedToday} (Expected: ₹1000)`);
  if (uNew.salaryEarnedToday !== 1000 || uNew.salaryEarnedThisWeek !== 1000) {
    console.error('  --> FAIL!');
    passed = false;
  } else {
    console.log('  --> PASS!');
  }

  // Clean up
  console.log('\nCleaning up database modifications...');
  await Cafe.deleteOne({ cafeId: 'TEST_CAFE_EXISTING' });
  await Cafe.deleteOne({ cafeId: 'TEST_CAFE_NEW' });
  await Branch.deleteOne({ branchId: 'TEST_BRANCH_EXISTING' });
  await Branch.deleteOne({ branchId: 'TEST_BRANCH_NEW' });
  await User.deleteOne({ employeeId: 'EMP_FULL_DAY' });
  await User.deleteOne({ employeeId: 'EMP_HALF_DAY' });
  await User.deleteOne({ employeeId: 'EMP_ABSENT' });
  await User.deleteOne({ employeeId: 'EMP_MULTI_DAY' });
  await User.deleteOne({ employeeId: 'EMP_NEW_CAFE' });
  await Attendance.deleteMany({ staffId: { $in: [staff1._id, staff2._id, staff3._id, staff4._id, staffNewCafe._id] } });
  console.log('Cleanup completed.');

  if (passed) {
    console.log('\n====================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! ✅');
    console.log('====================================');
  } else {
    console.error('\n====================================');
    console.error('SOME TESTS FAILED! ❌');
    console.error('====================================');
  }

  await mongoose.connection.close();
}

test().catch(console.error);
