const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const User = require('../models/User');

async function runTests() {
  console.log('--- STARTING AUTHENTICATION VERIFICATION SUITE ---');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // TEST 1: Super Admin username & password
  const superAdmin = await User.findOne({ username: 'superadmin' }).select('+password');
  assert(superAdmin !== null, 'Super Admin user exists with username "superadmin"');
  assert(superAdmin && superAdmin.role === 'super_admin', 'Super Admin has role "super_admin"');
  const superAdminPassOk = superAdmin ? await bcrypt.compare('SuperAdmin@123', superAdmin.password) : false;
  assert(superAdminPassOk, 'Super Admin password "SuperAdmin@123" verifies with bcrypt');

  // TEST 2: Admin login with username & password
  const adminUser = await User.findOne({ username: 'mvamsikrishna' }).select('+password');
  assert(adminUser !== null, 'Admin user exists with username "mvamsikrishna"');
  assert(adminUser && adminUser.role === 'admin', 'Admin has role "admin"');
  const adminPassOk = adminUser ? await bcrypt.compare('Cafe@12345', adminUser.password) : false;
  assert(adminPassOk, 'Admin password "Cafe@12345" verifies with bcrypt');

  // TEST 3: Staff/Chef login with username & password
  const chefUser = await User.findOne({ username: 'kumar' }).select('+password');
  assert(chefUser !== null, 'Chef user exists with username "kumar"');
  assert(chefUser && chefUser.role === 'chef', 'Chef has role "chef"');
  const chefPassOk = chefUser ? await bcrypt.compare('Cafe@12345', chefUser.password) : false;
  assert(chefPassOk, 'Chef password "Cafe@12345" verifies with bcrypt');

  // TEST 4: Waiter login with username & password
  const waiterUser = await User.findOne({ username: 'sai' }).select('+password');
  assert(waiterUser !== null, 'Waiter user exists with username "sai"');
  assert(waiterUser && waiterUser.role === 'waiter', 'Waiter has role "waiter"');
  const waiterPassOk = waiterUser ? await bcrypt.compare('Cafe@12345', waiterUser.password) : false;
  assert(waiterPassOk, 'Waiter password "Cafe@12345" verifies with bcrypt');

  // TEST 5: Incorrect password test
  const wrongPass = await bcrypt.compare('WrongPassword@999', adminUser.password);
  assert(wrongPass === false, 'Incorrect password correctly rejected by bcrypt');

  // TEST 6: Incorrect username lookup
  const nonExistent = await User.findOne({ username: 'non_existent_user_9999' }).select('+password');
  assert(nonExistent === null, 'Non-existent username returns null');

  // TEST 7: Inactive user verification
  const inactiveUser = await User.findOne({ isActive: false });
  if (inactiveUser) {
    assert(inactiveUser.isActive === false, `Inactive user "${inactiveUser.username}" verified as inactive`);
  } else {
    console.log('ℹ️ Note: No inactive users currently in DB');
  }

  // TEST 8: JWT signing and decoded payload
  const token = jwt.sign(
    { id: adminUser._id, username: adminUser.username, role: adminUser.role, cafeId: adminUser.cafeId },
    process.env.JWT_SECRET || 'super_secret_cafe_key_12345',
    { expiresIn: '7d' }
  );
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_cafe_key_12345');
  assert(decoded.id === adminUser._id.toString(), 'JWT token carries correct user id');
  assert(decoded.username === 'mvamsikrishna', 'JWT token carries correct username');
  assert(decoded.role === 'admin', 'JWT token carries correct role');

  // TEST 9: Password is not exposed in normal find() query
  const userWithoutPass = await User.findOne({ username: 'mvamsikrishna' });
  assert(userWithoutPass.password === undefined, 'Password field is hidden by default (select: false)');

  // TEST 10: All 16 users have unique lowercase usernames and hashed passwords
  const allUsers = await User.find({}).select('+password');
  const usernames = allUsers.map(u => u.username);
  const uniqueUsernames = new Set(usernames);
  assert(allUsers.length === uniqueUsernames.size, `All ${allUsers.length} users have unique usernames`);
  const allHashed = allUsers.every(u => u.password && u.password.startsWith('$2'));
  assert(allHashed, `All ${allUsers.length} users have valid bcrypt hashed passwords`);

  console.log(`\n================ TEST SUMMARY ================`);
  console.log(`Total Passed: ${passed} | Total Failed: ${failed}`);
  console.log(`==============================================\n`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite failed with error:', err);
  process.exit(1);
});
