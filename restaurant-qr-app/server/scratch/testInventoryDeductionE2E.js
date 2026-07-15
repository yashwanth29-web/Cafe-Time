const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const Cafe = require('../models/Cafe');
const Branch = require('../models/Branch');
const MenuItem = require('../models/MenuItem');
const Inventory = require('../models/Inventory');
const InventoryLog = require('../models/InventoryLog');
const Order = require('../models/Order');
const OperationalConfig = require('../models/OperationalConfig');
const { deductInventoryForOrder } = require('../controllers/inventoryController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';

const runTests = async () => {
  console.log('Connecting to database...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected!');

  const cafeId = 'E2E_CAFE';
  const branch1Id = 'E2E_BRANCH_1';
  const branch2Id = 'E2E_BRANCH_2';

  // Cleanup past test data
  console.log('Cleaning up past test data...');
  await Cafe.deleteMany({ cafeId });
  await Branch.deleteMany({ cafeId });
  await MenuItem.deleteMany({ cafeId });
  await Inventory.deleteMany({ cafeId });
  await InventoryLog.deleteMany({ cafeId });
  await Order.deleteMany({ cafeId });
  await OperationalConfig.deleteMany({ cafeId });

  // 1. Setup Cafes and Branches
  console.log('Setting up cafes and branches...');
  await Cafe.create({ cafeId, name: 'E2E Cafe', ownerEmail: 'e2e@cafe.local', isActive: true });
  await Branch.create({ branchId: branch1Id, branchName: 'Branch 1', cafeId, address: 'Addr 1', isActive: true });
  await Branch.create({ branchId: branch2Id, branchName: 'Branch 2', cafeId, address: 'Addr 2', isActive: true });

  await OperationalConfig.create({ cafeId, branchId: branch1Id, inventoryEnabled: true });
  await OperationalConfig.create({ cafeId, branchId: branch2Id, inventoryEnabled: true });

  // 2. Setup Inventory Items
  console.log('Setting up inventory ingredients...');
  const ingA1 = await Inventory.create({
    cafeId,
    branchId: branch1Id,
    name: 'Ingredient A',
    quantity: 100, // 100g
    unit: 'g',
    costPrice: 0.5,
    reorderLevel: 20
  });

  const ingB1 = await Inventory.create({
    cafeId,
    branchId: branch1Id,
    name: 'Ingredient B',
    quantity: 50, // 50ml
    unit: 'ml',
    costPrice: 0.2,
    reorderLevel: 10
  });

  // Setup same ingredients for Branch 2 to verify isolation
  const ingA2 = await Inventory.create({
    cafeId,
    branchId: branch2Id,
    name: 'Ingredient A',
    quantity: 500,
    unit: 'g',
    costPrice: 0.5,
    reorderLevel: 20
  });

  // 3. Setup Menu Items with Recipes
  console.log('Setting up menu items and recipes...');
  const coffeeItem = await MenuItem.create({
    cafeId,
    branchId: branch1Id,
    name: 'E2E Coffee',
    price: 150,
    category: 'Coffee Selection',
    description: 'Delicious coffee',
    available: true,
    recipe: [
      { name: 'Ingredient A', quantity: 10, unit: 'g' },
      { name: 'Ingredient B', quantity: 5, unit: 'ml' }
    ]
  });

  // ============================================
  // TEST 1: Skip deduction for unpaid orders
  // ============================================
  console.log('\n--- TEST 1: Skipping deduction for unpaid order ---');
  const order1 = await Order.create({
    cafeId,
    branchId: branch1Id,
    tableNumber: '4',
    items: [{ id: coffeeItem._id, name: coffeeItem.name, price: coffeeItem.price, quantity: 2 }],
    totalAmount: 300,
    paymentStatus: 'Pending',
    status: 'Placed'
  });

  await deductInventoryForOrder(order1._id, cafeId, order1.items);

  // Check that stock was NOT deducted
  const checkIngA1 = await Inventory.findById(ingA1._id);
  const checkIngB1 = await Inventory.findById(ingB1._id);
  console.log(`Ingredient A stock (Expected 100): ${checkIngA1.quantity}`);
  console.log(`Ingredient B stock (Expected 50): ${checkIngB1.quantity}`);
  if (checkIngA1.quantity !== 100 || checkIngB1.quantity !== 50) {
    throw new Error('Test 1 Failed: Stock was deducted for unpaid order.');
  }
  console.log('Test 1 Passed!');

  // ============================================
  // TEST 2: Successful stock deduction
  // ============================================
  console.log('\n--- TEST 2: Successful stock deduction on Paid order ---');
  // Update order to paid
  order1.paymentStatus = 'Paid';
  order1.status = 'Completed';
  order1.razorpayPaymentId = 'TRANS_12345';
  await order1.save();

  await deductInventoryForOrder(order1._id, cafeId, order1.items);

  // Check stocks (should deduct 10g * 2 = 20g, and 5ml * 2 = 10ml)
  const dedIngA1 = await Inventory.findById(ingA1._id);
  const dedIngB1 = await Inventory.findById(ingB1._id);
  console.log(`Ingredient A stock (Expected 80): ${dedIngA1.quantity}`);
  console.log(`Ingredient B stock (Expected 40): ${dedIngB1.quantity}`);
  if (dedIngA1.quantity !== 80 || dedIngB1.quantity !== 40) {
    throw new Error('Test 2 Failed: Stock deduction was incorrect.');
  }

  // Check inventory logs
  const logEntries = await InventoryLog.find({ orderId: order1._id });
  console.log(`Log entries created (Expected 2): ${logEntries.length}`);
  if (logEntries.length !== 2) {
    throw new Error('Test 2 Failed: Missing log entries.');
  }
  
  // Verify log fields
  const log1 = logEntries[0];
  console.log(`Log fields checked - paymentId: ${log1.paymentId}, oldQuantity: ${log1.oldQuantity}, remainingQuantity: ${log1.remainingQuantity}`);
  if (!log1.paymentId || log1.oldQuantity === undefined || log1.remainingQuantity === undefined) {
    throw new Error('Test 2 Failed: Log is missing detailed audit fields.');
  }

  console.log('Test 2 Passed!');

  // ============================================
  // TEST 3: Idempotency (Retry protection)
  // ============================================
  console.log('\n--- TEST 3: Idempotency protection ---');
  // Re-run deduction for the same order
  await deductInventoryForOrder(order1._id, cafeId, order1.items);

  const idemIngA1 = await Inventory.findById(ingA1._id);
  const idemIngB1 = await Inventory.findById(ingB1._id);
  console.log(`Ingredient A stock after retry (Expected 80): ${idemIngA1.quantity}`);
  console.log(`Ingredient B stock after retry (Expected 40): ${idemIngB1.quantity}`);
  if (idemIngA1.quantity !== 80 || idemIngB1.quantity !== 40) {
    throw new Error('Test 3 Failed: Idempotency check failed, double-deducted!');
  }
  console.log('Test 3 Passed!');

  // ============================================
  // TEST 4: Isolation verification
  // ============================================
  console.log('\n--- TEST 4: Branch isolation verification ---');
  // Verify Branch 2 stock was untouched
  const branch2IngA = await Inventory.findById(ingA2._id);
  console.log(`Branch 2 Ingredient A stock (Expected 500): ${branch2IngA.quantity}`);
  if (branch2IngA.quantity !== 500) {
    throw new Error('Test 4 Failed: Branch 2 stock was leaked/changed.');
  }
  console.log('Test 4 Passed!');

  // ============================================
  // TEST 5: Unit conversion (kg -> g)
  // ============================================
  console.log('\n--- TEST 5: Unit conversion (kg -> g) ---');
  const coffeeBeansInv = await Inventory.create({
    cafeId,
    branchId: branch1Id,
    name: 'Coffee Beans',
    quantity: 1, // 1 kg
    unit: 'kg',
    costPrice: 400,
    reorderLevel: 0.1
  });

  const espressoItem = await MenuItem.create({
    cafeId,
    branchId: branch1Id,
    name: 'Espresso',
    price: 100,
    category: 'Coffee Selection',
    description: 'Strong espresso',
    available: true,
    recipe: [
      { name: 'Coffee Beans', quantity: 20, unit: 'g' } // 20g (should convert to 0.02kg)
    ]
  });

  const order2 = await Order.create({
    cafeId,
    branchId: branch1Id,
    tableNumber: '2',
    items: [{ id: espressoItem._id, name: espressoItem.name, price: espressoItem.price, quantity: 1 }],
    totalAmount: 100,
    paymentStatus: 'Paid',
    status: 'Completed',
    razorpayPaymentId: 'TRANS_56789'
  });

  await deductInventoryForOrder(order2._id, cafeId, order2.items);

  const checkBeans = await Inventory.findById(coffeeBeansInv._id);
  console.log(`Coffee Beans remaining (Expected 0.98 kg): ${checkBeans.quantity} kg`);
  if (Math.abs(checkBeans.quantity - 0.98) > 0.0001) {
    throw new Error('Test 5 Failed: Unit conversion deduction was incorrect.');
  }
  console.log('Test 5 Passed!');

  // ============================================
  // TEST 6: Transaction rollback on insufficient stock
  // ============================================
  console.log('\n--- TEST 6: Transaction rollback on insufficient stock ---');
  // Reset stocks
  await Inventory.findByIdAndUpdate(ingA1._id, { quantity: 15 }); // Only 15g left
  await Inventory.findByIdAndUpdate(ingB1._id, { quantity: 50 });

  const order3 = await Order.create({
    cafeId,
    branchId: branch1Id,
    tableNumber: '1',
    items: [{ id: coffeeItem._id, name: coffeeItem.name, price: coffeeItem.price, quantity: 2 }], // Needs 20g A
    totalAmount: 300,
    paymentStatus: 'Paid',
    status: 'Completed',
    razorpayPaymentId: 'TRANS_ROLLBACK'
  });

  let threwError = false;
  try {
    await deductInventoryForOrder(order3._id, cafeId, order3.items);
  } catch (err) {
    console.log('Caught expected stock error:', err.message);
    threwError = true;
  }

  if (!threwError) {
    throw new Error('Test 6 Failed: System did not block negative stock.');
  }

  // Verify transaction rolled back: Ingredient B was NOT deducted partially
  const rollbackA = await Inventory.findById(ingA1._id);
  const rollbackB = await Inventory.findById(ingB1._id);
  const checkOrder3 = await Order.findById(order3._id);

  console.log(`Ingredient A stock after rollback (Expected 15): ${rollbackA.quantity}`);
  console.log(`Ingredient B stock after rollback (Expected 50): ${rollbackB.quantity}`);
  console.log(`Order inventoryDeducted status (Expected false): ${checkOrder3.inventoryDeducted}`);

  if (rollbackA.quantity !== 15 || rollbackB.quantity !== 50 || checkOrder3.inventoryDeducted !== false) {
    throw new Error('Test 6 Failed: Transaction rollback failed. Stocks are inconsistent.');
  }
  console.log('Test 6 Passed!');

  // ============================================
  // TEST 7: Concurrent payment race condition locking
  // ============================================
  console.log('\n--- TEST 7: Concurrent updates race condition test ---');
  // Replenish stock
  await Inventory.findByIdAndUpdate(ingA1._id, { quantity: 100 });
  await Inventory.findByIdAndUpdate(ingB1._id, { quantity: 100 });

  const order4 = await Order.create({
    cafeId,
    branchId: branch1Id,
    tableNumber: '3',
    items: [{ id: coffeeItem._id, name: coffeeItem.name, price: coffeeItem.price, quantity: 2 }], // Needs 20g A, 10ml B
    totalAmount: 300,
    paymentStatus: 'Paid',
    status: 'Completed',
    razorpayPaymentId: 'TRANS_CONCURRENT'
  });

  // Run 4 concurrent requests at the exact same time
  console.log('Sending 4 concurrent deduction requests...');
  const promises = [
    deductInventoryForOrder(order4._id, cafeId, order4.items),
    deductInventoryForOrder(order4._id, cafeId, order4.items),
    deductInventoryForOrder(order4._id, cafeId, order4.items),
    deductInventoryForOrder(order4._id, cafeId, order4.items)
  ];

  const results = await Promise.allSettled(promises);
  const succeededCount = results.filter(r => r.status === 'fulfilled').length;
  console.log(`Fulfilled requests (Expected 1 or more, but only first does deduction): ${succeededCount}`);

  const finalA = await Inventory.findById(ingA1._id);
  const finalB = await Inventory.findById(ingB1._id);
  console.log(`Final stock A (Expected 80): ${finalA.quantity}`);
  console.log(`Final stock B (Expected 90): ${finalB.quantity}`);

  if (finalA.quantity !== 80 || finalB.quantity !== 90) {
    throw new Error('Test 7 Failed: Concurrent requests caused multiple stock deductions!');
  }
  console.log('Test 7 Passed!');

  // Clean up
  console.log('\nCleaning up E2E test data...');
  await Cafe.deleteMany({ cafeId });
  await Branch.deleteMany({ cafeId });
  await MenuItem.deleteMany({ cafeId });
  await Inventory.deleteMany({ cafeId });
  await InventoryLog.deleteMany({ cafeId });
  await Order.deleteMany({ cafeId });
  await OperationalConfig.deleteMany({ cafeId });

  await mongoose.connection.close();
  console.log('\nALL E2E INTEGRATION TESTS PASSED SUCCESSFULLY! 🎯');
};

runTests().catch(err => {
  console.error('\nE2E INTEGRATION TEST RUNNER FAILED ❌');
  console.error(err);
  mongoose.connection.close().then(() => process.exit(1));
});
