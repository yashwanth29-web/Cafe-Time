const mongoose = require('mongoose');
const MenuItem = require('./models/MenuItem');
const axios = require('axios');
require('dotenv').config();

async function runTests() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe');
  console.log('--- Connected to MongoDB ---');

  const MASTER_CAFE = 'CD001';
  const MASTER_BRANCH = 'default';
  const TEST_CAFE = 'CP002';
  const TEST_BRANCH = 'CP002-BR1';
  const API_URL = 'http://localhost:5000/api/menu';

  // Move jwt require here
  const jwt = require('jsonwebtoken');
  let token;
  let reqConfig;

  // Helper for fetchMenu
  const fetchMenu = async (cafeId, branchId) => {
    const res = await axios.get(API_URL, { 
      headers: { 
        'x-cafe-id': cafeId, 
        'x-branch-id': branchId,
        'Authorization': `Bearer ${token}` 
      }
    });
    return res.data.data;
  };

  try {
    const User = require('./models/User');
    const Branch = require('./models/Branch');
    
    // Create dummy branch if it doesn't exist
    await Branch.findOneAndUpdate(
      { cafeId: TEST_CAFE, branchId: TEST_BRANCH },
      { name: 'Test Branch', isActive: true },
      { upsert: true, returnDocument: 'after' }
    );
    
    let dummyUser = await User.findOne({ cafeId: TEST_CAFE });
    if (!dummyUser) {
      dummyUser = await User.create({
        name: 'Test Owner',
        email: 'testowner@test.com',
        phone: '1234567890',
        role: 'owner',
        cafeId: TEST_CAFE,
        isActive: true
      });
    }
    token = jwt.sign({ id: dummyUser._id.toString(), role: dummyUser.role || 'admin', cafeId: TEST_CAFE }, process.env.JWT_SECRET || 'super_secret_cafe_key_12345', { expiresIn: '1d' });
    
    reqConfig = (cafeId, branchId) => ({
      headers: {
        'x-cafe-id': cafeId,
        'x-branch-id': branchId,
        'Authorization': `Bearer ${token}`
      }
    });
    const masterMenu = await fetchMenu(MASTER_CAFE, MASTER_BRANCH);
    console.log(`PASS: Master Menu fetched: ${masterMenu.length} items.`);
    
    let testBranchMenu = await fetchMenu(TEST_CAFE, TEST_BRANCH);
    console.log(`PASS: Initial Test Branch Menu fetched: ${testBranchMenu.length} items.`);

    const itemToEdit = masterMenu[0];
    
    console.log(`\n--- Testing EDIT (Local Override) ---`);
    const editRes = await axios.patch(`${API_URL}/${itemToEdit._id}`, 
      { price: 999.99 }, 
      reqConfig(TEST_CAFE, TEST_BRANCH)
    );
    console.log(`PASS: Edit API called. Success: ${editRes.data.success}`);
    
    const override = await MenuItem.findOne({ masterItemId: itemToEdit._id, cafeId: TEST_CAFE, branchId: TEST_BRANCH });
    console.log(override ? 'PASS: Override created in DB with price: ' + override.price : 'FAIL: Override missing!');

    testBranchMenu = await fetchMenu(TEST_CAFE, TEST_BRANCH);
    const updatedBranchItem = testBranchMenu.find(i => i.name === itemToEdit.name);
    console.log(updatedBranchItem.price === 999.99 ? 'PASS: Menu fetch returned overridden price' : 'FAIL: Menu fetch returned original price');

    const freshMasterMenu = await fetchMenu(MASTER_CAFE, MASTER_BRANCH);
    const untouchedMasterItem = freshMasterMenu.find(i => i._id === itemToEdit._id);
    console.log(untouchedMasterItem.price === itemToEdit.price ? 'PASS: Master menu remains untouched' : 'FAIL: Master menu was modified!');

    console.log(`\n--- Testing ADD (Custom Local Item) ---`);
    const addRes = await axios.post(API_URL, 
      { name: 'TEST_ITEM_123', price: 50.00, category: 'Test' }, 
      reqConfig(TEST_CAFE, TEST_BRANCH)
    );
    console.log(`PASS: Add API called. Success: ${addRes.data.success}`);
    
    testBranchMenu = await fetchMenu(TEST_CAFE, TEST_BRANCH);
    const foundCustom = testBranchMenu.find(i => i.name === 'TEST_ITEM_123');
    console.log(foundCustom ? 'PASS: Custom item appears in branch menu' : 'FAIL: Custom item missing from branch menu');
    
    const freshMasterMenu2 = await fetchMenu(MASTER_CAFE, MASTER_BRANCH);
    const foundInMaster = freshMasterMenu2.find(i => i.name === 'TEST_ITEM_123');
    console.log(!foundInMaster ? 'PASS: Custom item does NOT appear in master menu' : 'FAIL: Custom item leaked into master menu');

    console.log(`\n--- Testing DELETE (Hiding Master Item) ---`);
    const itemToDelete = masterMenu[1];
    const delRes = await axios.delete(`${API_URL}/${itemToDelete._id}`, reqConfig(TEST_CAFE, TEST_BRANCH));
    console.log(`PASS: Delete API called. Success: ${delRes.data.success}`);
    
    testBranchMenu = await fetchMenu(TEST_CAFE, TEST_BRANCH);
    const isMissing = !testBranchMenu.find(i => i.name === itemToDelete.name);
    console.log(isMissing ? 'PASS: Item successfully hidden from branch menu' : 'FAIL: Item still appears in branch menu');
    
    const freshMasterMenu3 = await fetchMenu(MASTER_CAFE, MASTER_BRANCH);
    const stillInMaster = freshMasterMenu3.find(i => i._id === itemToDelete._id);
    console.log(stillInMaster ? 'PASS: Item still safely exists in master menu' : 'FAIL: Item was accidentally deleted from master menu');

    console.log(`\n--- Cleaning up test artifacts ---`);
    await MenuItem.deleteMany({ cafeId: TEST_CAFE, branchId: TEST_BRANCH, masterItemId: itemToEdit._id });
    await MenuItem.deleteMany({ cafeId: TEST_CAFE, branchId: TEST_BRANCH, masterItemId: itemToDelete._id });
    await MenuItem.deleteMany({ cafeId: TEST_CAFE, branchId: TEST_BRANCH, name: 'TEST_ITEM_123' });
    console.log('PASS: Cleanup complete.');
  } catch(e) {
    console.error('FAIL: Test failed:', e.message);
    if(e.response && e.response.data) {
      console.error(e.response.data);
    }
  } finally {
    mongoose.disconnect();
  }
}
runTests();
