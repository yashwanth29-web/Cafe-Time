const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Cafe = require('../models/Cafe');
const Branch = require('../models/Branch');
const { getBranches } = require('../controllers/adminController');

// Helper to mock Express req, res
const mockRequest = (user, query = {}) => ({
  user,
  query,
  headers: {},
  cookies: {}
});

const mockResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.status = function(code) { this.statusCode = code; return this; };
  res.json = function(data) { this.responseData = data; return this; };
  return res;
};

async function testGetBranches() {
  console.log('========================================================');
  console.log('STARTING ENTERPRISE TEST: BRANCH CONTEXT LOAD FIX');
  console.log('========================================================');

  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  let allChecksPassed = true;

  try {
    // 1. Setup mock data
    console.log('\n--- 1. Setting up mock data ---');
    const cafe1 = new Cafe({ cafeId: 'T_BR_CAFE_1', name: 'Test Cafe 1', ownerEmail: 'owner@tbr1.com', address: 'Add 1', ownerEmail: 'owner@tbr1.com' });
    const cafe2 = new Cafe({ cafeId: 'T_BR_CAFE_2', name: 'Test Cafe 2', ownerEmail: 'owner@tbr2.com', address: 'Add 2', ownerEmail: 'owner@tbr2.com' });
    
    const branch1 = new Branch({ branchId: 'T_BRANCH_1', branchName: 'Branch 1', cafeId: 'T_BR_CAFE_1', address: 'Addr 1', isActive: true });
    const branch2 = new Branch({ branchId: 'T_BRANCH_2', branchName: 'Branch 2', cafeId: 'T_BR_CAFE_1', address: 'Addr 2', isActive: true });
    const branch3 = new Branch({ branchId: 'T_BRANCH_3', branchName: 'Branch 3', cafeId: 'T_BR_CAFE_2', address: 'Addr 3', isActive: true });

    const superAdmin = new User({ name: 'SA User', role: 'super_admin', email: 'sa@test.com', phone: '1', cafeId: '', isActive: true, employeeId: 'SA_1' });
    const owner1 = new User({ name: 'Owner 1', role: 'owner', email: 'owner@tbr1.com', phone: '2', cafeId: 'T_BR_CAFE_1', isActive: true, employeeId: 'OWN_1' });
    const staff1 = new User({ name: 'Staff 1', role: 'staff', email: 'staff@tbr1.com', phone: '3', cafeId: 'T_BR_CAFE_1', assignedBranch: 'T_BRANCH_1', isActive: true, employeeId: 'STF_1' });

    await cafe1.save();
    await cafe2.save();
    await branch1.save();
    await branch2.save();
    await branch3.save();
    await superAdmin.save();
    await owner1.save();
    await staff1.save();
    console.log('Mock setup complete.');

    // 2. Test Super Admin GET /api/admin/branches (No cafeId filter - should return all)
    console.log('\n--- 2. Testing Super Admin access (all branches) ---');
    const reqSA = mockRequest(superAdmin);
    const resSA = mockResponse();
    await getBranches(reqSA, resSA);
    
    console.log(`  Super Admin branches count: ${resSA.responseData.branches.length} (Expected: 3+)`);
    if (resSA.statusCode !== 200 || !resSA.responseData.success || resSA.responseData.branches.length < 3) {
      console.error('  --> SUPER ADMIN GENERAL ACCESS CHECK FAILED!');
      allChecksPassed = false;
    } else {
      console.log('  --> Super Admin General Access Check PASS!');
    }

    // 3. Test Super Admin GET /api/admin/branches?cafeId=T_BR_CAFE_1 (With cafeId filter)
    console.log('\n--- 3. Testing Super Admin access with cafeId filter ---');
    const reqSAFilter = mockRequest(superAdmin, { cafeId: 'T_BR_CAFE_1' });
    const resSAFilter = mockResponse();
    await getBranches(reqSAFilter, resSAFilter);

    console.log(`  Filtered branches count: ${resSAFilter.responseData.branches.length} (Expected: 2)`);
    if (resSAFilter.statusCode !== 200 || resSAFilter.responseData.branches.length !== 2) {
      console.error('  --> SUPER ADMIN FILTERED ACCESS CHECK FAILED!');
      allChecksPassed = false;
    } else {
      console.log('  --> Super Admin Filtered Access Check PASS!');
    }

    // 4. Test Owner 1 GET /api/admin/branches (Should return only T_BR_CAFE_1 branches)
    console.log('\n--- 4. Testing Cafe Owner access ---');
    const reqOwner = mockRequest(owner1);
    const resOwner = mockResponse();
    await getBranches(reqOwner, resOwner);

    console.log(`  Owner branches count: ${resOwner.responseData.branches.length} (Expected: 2)`);
    if (resOwner.statusCode !== 200 || resOwner.responseData.branches.length !== 2) {
      console.error('  --> OWNER ACCESS CHECK FAILED!');
      allChecksPassed = false;
    } else {
      console.log('  --> Owner Access Check PASS!');
    }

    // 5. Test Staff 1 GET /api/admin/branches (Should return only T_BRANCH_1)
    console.log('\n--- 5. Testing Staff access (strictly locked to assigned branch) ---');
    const reqStaff = mockRequest(staff1);
    const resStaff = mockResponse();
    await getBranches(reqStaff, resStaff);

    console.log(`  Staff branches count: ${resStaff.responseData.branches.length} (Expected: 1)`);
    console.log(`  Staff branch ID: ${resStaff.responseData.branches[0]?.branchId} (Expected: T_BRANCH_1)`);
    if (resStaff.statusCode !== 200 || resStaff.responseData.branches.length !== 1 || resStaff.responseData.branches[0].branchId !== 'T_BRANCH_1') {
      console.error('  --> STAFF ACCESS CHECK FAILED!');
      allChecksPassed = false;
    } else {
      console.log('  --> Staff Access Check PASS!');
    }

  } catch (err) {
    console.error('Test exception occurred:', err);
    allChecksPassed = false;
  } finally {
    // Cleanup
    console.log('\n--- Cleaning up mock branches and users ---');
    await Cafe.deleteMany({ cafeId: { $in: ['T_BR_CAFE_1', 'T_BR_CAFE_2'] } });
    await Branch.deleteMany({ branchId: { $in: ['T_BRANCH_1', 'T_BRANCH_2', 'T_BRANCH_3'] } });
    await User.deleteMany({ email: { $in: ['sa@test.com', 'owner@tbr1.com', 'staff@tbr1.com'] } });
    console.log('Cleanup complete.');
  }

  console.log('\n========================================================');
  if (allChecksPassed) {
    console.log('STATUS REPORT: ALL BRANCH CONTEXT TESTS PASSED ✅');
  } else {
    console.error('STATUS REPORT: BRANCH CONTEXT TESTS FAILED ❌');
  }
  console.log('========================================================');

  await mongoose.connection.close();
}

testGetBranches().catch(console.error);
