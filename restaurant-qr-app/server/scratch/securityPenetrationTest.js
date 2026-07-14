const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Cafe = require('../models/Cafe');
const Branch = require('../models/Branch');
const OtpVerification = require('../models/OtpVerification');
const { protect, restrictTo } = require('../middleware/authMiddleware');
const { attachCafeAndBranch } = require('../middleware/branchMiddleware');

// Helper to mock Express req, res, next
const mockRequest = (token, role, cafeId, assignedBranch, path, method = 'GET', headers = {}, query = {}, body = {}) => {
  const req = {
    path,
    method,
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : undefined
    },
    query,
    body,
    cookies: {}
  };
  return req;
};

const mockResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.responseData = data;
    return this;
  };
  return res;
};

async function runSecurityAudit() {
  console.log('========================================================');
  console.log('STARTING ENTERPRISE SECURITY AUDIT: AUTH & AUTHZ SYSTEM');
  console.log('========================================================');

  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  let allChecksPassed = true;

  try {
    // -------------------------------------------------------------
    // SETUP MOCK ACCOUNTS
    // -------------------------------------------------------------
    console.log('\n--- Creating mock accounts for security simulation ---');
    
    // Create mock Cafe and Branch
    const testCafe = new Cafe({ cafeId: 'SEC_CAFE_1', name: 'Security Cafe 1', address: 'Sec 1 Address', ownerEmail: 'owner@sec1.com' });
    const testBranch1 = new Branch({ branchId: 'SEC_BRANCH_1', branchName: 'Sec Branch 1', cafeId: 'SEC_CAFE_1', address: 'B1 Address' });
    const testBranch2 = new Branch({ branchId: 'SEC_BRANCH_2', branchName: 'Sec Branch 2', cafeId: 'SEC_CAFE_1', address: 'B2 Address' });
    
    await testCafe.save();
    await testBranch1.save();
    await testBranch2.save();

    // Active Owner
    const owner = new User({
      name: 'Owner Account', email: 'owner@sec1.com', phone: '9900000001', role: 'owner',
      cafeId: 'SEC_CAFE_1', assignedBranch: 'default', isActive: true, employeeId: 'OWN_SEC'
    });
    // Inactive/Suspended Owner
    const suspendedOwner = new User({
      name: 'Suspended Owner', email: 'suspended@sec1.com', phone: '9900000002', role: 'owner',
      cafeId: 'SEC_CAFE_1', assignedBranch: 'default', isActive: false, employeeId: 'OWN_SUS'
    });
    // Active Staff in Branch 1
    const staffBranch1 = new User({
      name: 'Staff Branch 1', email: 'staff1@sec1.com', phone: '9900000003', role: 'staff',
      cafeId: 'SEC_CAFE_1', assignedBranch: 'SEC_BRANCH_1', isActive: true, employeeId: 'STF_SEC_1'
    });

    await owner.save();
    await suspendedOwner.save();
    await staffBranch1.save();

    // Generate valid tokens
    const jwtSecret = process.env.JWT_SECRET || 'super_secret_cafe_key_12345';
    const tokenOwner = jwt.sign({ id: owner._id, role: owner.role, cafeId: owner.cafeId }, jwtSecret, { expiresIn: '1h' });
    const tokenSuspended = jwt.sign({ id: suspendedOwner._id, role: suspendedOwner.role, cafeId: suspendedOwner.cafeId }, jwtSecret, { expiresIn: '1h' });
    const tokenStaff = jwt.sign({ id: staffBranch1._id, role: staffBranch1.role, cafeId: staffBranch1.cafeId }, jwtSecret, { expiresIn: '1h' });
    const tokenInvalidId = jwt.sign({ id: new mongoose.Types.ObjectId(), role: 'staff', cafeId: 'SEC_CAFE_1' }, jwtSecret, { expiresIn: '1h' });
    
    const expiredToken = jwt.sign({ id: owner._id, role: owner.role, cafeId: owner.cafeId }, jwtSecret, { expiresIn: '-1s' });

    // -------------------------------------------------------------
    // AUDIT 1: INVALID AND SUSPENDED AUTHENTICATION
    // -------------------------------------------------------------
    console.log('\n--- Audit 1: Invalid & Suspended Authentication Verification ---');

    // Test protect with expired token
    const reqExpired = mockRequest(expiredToken);
    const resExpired = mockResponse();
    await protect(reqExpired, resExpired, () => {});
    console.log(`  Expired token returns status: ${resExpired.statusCode} (Expected: 401)`);
    if (resExpired.statusCode !== 401) allChecksPassed = false;

    // Test protect with non-existing user ID
    const reqInvalidId = mockRequest(tokenInvalidId);
    const resInvalidId = mockResponse();
    await protect(reqInvalidId, resInvalidId, () => {});
    console.log(`  Non-existing User ID returns status: ${resInvalidId.statusCode} (Expected: 401)`);
    if (resInvalidId.statusCode !== 401) allChecksPassed = false;

    // Test protect with suspended/deactivated account
    const reqSuspended = mockRequest(tokenSuspended);
    const resSuspended = mockResponse();
    await protect(reqSuspended, resSuspended, () => {});
    console.log(`  Deactivated/Suspended User returns status: ${resSuspended.statusCode} (Expected: 401)`);
    if (resSuspended.statusCode !== 401) allChecksPassed = false;

    // Test protect with no token (customer or unauthorized)
    const reqNoToken = mockRequest(null);
    const resNoToken = mockResponse();
    await protect(reqNoToken, resNoToken, () => {});
    console.log(`  No token (unauthorized access) returns status: ${resNoToken.statusCode} (Expected: 401)`);
    if (resNoToken.statusCode !== 401) allChecksPassed = false;

    // -------------------------------------------------------------
    // AUDIT 2: ROLE-BASED ACCESS CONTROL (RBAC) & PRIVILEGE ESCALATION
    // -------------------------------------------------------------
    console.log('\n--- Audit 2: Role-Based Access Control & Privilege Escalation Verification ---');

    // Staff tries to access Super Admin dashboard stats
    // restrictTo('super_admin') middleware execution check
    const restrictSuperAdmin = restrictTo('super_admin');
    
    // Create request with staff user attached (simulating pre-execution of protect)
    const reqStaffToSA = { user: staffBranch1 };
    const resStaffToSA = mockResponse();
    restrictSuperAdmin(reqStaffToSA, resStaffToSA, () => { reqStaffToSA.allowed = true; });
    console.log(`  Staff accessing Super Admin restricted endpoint returns status: ${resStaffToSA.statusCode} (Expected: 403, allowed: ${reqStaffToSA.allowed ? 'Yes' : 'No'})`);
    if (resStaffToSA.statusCode !== 403 || reqStaffToSA.allowed) allChecksPassed = false;

    // Staff tries to access Owner restricted endpoint (restrictTo('admin', 'owner'))
    const restrictOwner = restrictTo('admin', 'owner');
    const reqStaffToOwner = { user: staffBranch1 };
    const resStaffToOwner = mockResponse();
    restrictOwner(reqStaffToOwner, resStaffToOwner, () => { reqStaffToOwner.allowed = true; });
    console.log(`  Staff accessing Owner restricted endpoint returns status: ${resStaffToOwner.statusCode} (Expected: 403, allowed: ${reqStaffToOwner.allowed ? 'Yes' : 'No'})`);
    if (resStaffToOwner.statusCode !== 403 || reqStaffToOwner.allowed) allChecksPassed = false;

    // Owner accessing Owner restricted endpoint
    const reqOwnerToOwner = { user: owner };
    const resOwnerToOwner = mockResponse();
    restrictOwner(reqOwnerToOwner, resOwnerToOwner, () => { reqOwnerToOwner.allowed = true; });
    console.log(`  Owner accessing Owner restricted endpoint allowed: ${reqOwnerToOwner.allowed ? 'Yes' : 'No'} (Expected: Yes)`);
    if (!reqOwnerToOwner.allowed) allChecksPassed = false;

    // -------------------------------------------------------------
    // AUDIT 3: MULTI-TENANCY CAFE & BRANCH ISOLATION
    // -------------------------------------------------------------
    console.log('\n--- Audit 3: Cafe & Branch Tenant Isolation Verification ---');

    // Staff from Branch 1 tries to access Branch 2
    // attachCafeAndBranch middleware execution check
    const reqStaffToBranch2 = mockRequest(tokenStaff, 'staff', 'SEC_CAFE_1', 'SEC_BRANCH_1', '/api/admin/staff', 'GET', {
      'x-cafe-id': 'SEC_CAFE_1',
      'x-branch-id': 'SEC_BRANCH_2'
    });
    // Attach staff user object (simulating auth middleware loading it)
    reqStaffToBranch2.user = staffBranch1;
    
    const resStaffToBranch2 = mockResponse();
    await attachCafeAndBranch(reqStaffToBranch2, resStaffToBranch2, () => { reqStaffToBranch2.allowed = true; });
    console.log(`  Staff (assigned SEC_BRANCH_1) requesting SEC_BRANCH_2 returns status: ${resStaffToBranch2.statusCode} (Expected: 403, allowed: ${reqStaffToBranch2.allowed ? 'Yes' : 'No'})`);
    if (resStaffToBranch2.statusCode !== 403 || reqStaffToBranch2.allowed) allChecksPassed = false;

    // Staff requesting their own branch
    const reqStaffToBranch1 = mockRequest(tokenStaff, 'staff', 'SEC_CAFE_1', 'SEC_BRANCH_1', '/api/admin/staff', 'GET', {
      'x-cafe-id': 'SEC_CAFE_1',
      'x-branch-id': 'SEC_BRANCH_1'
    });
    reqStaffToBranch1.user = staffBranch1;
    const resStaffToBranch1 = mockResponse();
    await attachCafeAndBranch(reqStaffToBranch1, resStaffToBranch1, () => { reqStaffToBranch1.allowed = true; });
    console.log(`  Staff requesting their own branch SEC_BRANCH_1 allowed: ${reqStaffToBranch1.allowed ? 'Yes' : 'No'} (Expected: Yes)`);
    if (!reqStaffToBranch1.allowed) allChecksPassed = false;

  } catch (err) {
    console.error('Audit exception occurred:', err);
    allChecksPassed = false;
  } finally {
    // Cleanup mock data
    console.log('\n--- Cleaning up audit mock data ---');
    await Cafe.deleteMany({ cafeId: 'SEC_CAFE_1' });
    await Branch.deleteMany({ cafeId: 'SEC_CAFE_1' });
    await User.deleteMany({ cafeId: 'SEC_CAFE_1' });
    console.log('Cleanup complete.');
  }

  console.log('\n========================================================');
  if (allChecksPassed) {
    console.log('SECURITY STATUS: ALL AUTH & AUTHZ AUDIT TESTS PASSED ✅');
  } else {
    console.error('SECURITY STATUS: SECURITY VULNERABILITIES DETECTED ❌');
  }
  console.log('========================================================');

  await mongoose.connection.close();
}

runSecurityAudit().catch(console.error);
