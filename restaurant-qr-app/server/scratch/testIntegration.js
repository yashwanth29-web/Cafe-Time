const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Order = require('../models/Order');
  const Inventory = require('../models/Inventory');
  const MenuItem = require('../models/MenuItem');
  const { deductInventoryForOrder } = require('../controllers/inventoryController');

  console.log('--- RESETTING STOCK TO 300 ---');
  await Inventory.updateOne({ name: 'Almond Powder' }, { quantity: 300 });

  // Get Badam Milk MenuItem to get correct ID
  const badamMilk = await MenuItem.findOne({ name: 'Badam Milk' });
  console.log('Badam Milk MenuItem ID:', badamMilk ? badamMilk._id : 'not found');

  console.log('--- CREATING TEST ORDER ---');
  const order = new Order({
    cafeId: 'CD001',
    tableNumber: '2',
    items: [
      {
        id: badamMilk ? badamMilk._id.toString() : '6a2a6d53b03e592c3b40975b',
        name: 'Badam Milk',
        price: 40,
        quantity: 1
      }
    ],
    totalAmount: 40,
    status: 'Placed',
    paymentStatus: 'Pending',
    paymentMethod: 'Counter',
    inventoryDeducted: false
  });
  await order.save();
  console.log('Order created:', order._id, 'status:', order.status, 'paymentStatus:', order.paymentStatus, 'inventoryDeducted:', order.inventoryDeducted);

  // 1. Simulating Chef marking "Ready"
  console.log('\n--- STEP 1: COOKING COMPLETED (READY) ---');
  order.status = 'Ready';
  await order.save();
  
  // Trigger deduction
  await deductInventoryForOrder(order._id, order.cafeId, order.items);

  let updatedOrder = await Order.findById(order._id);
  let almond = await Inventory.findOne({ name: 'Almond Powder' });
  console.log('Order status:', updatedOrder.status, 'inventoryDeducted:', updatedOrder.inventoryDeducted);
  console.log('Almond Powder stock:', almond.quantity, 'grams (Expected: 285)');

  // 2. Simulating Waiter marking "Payment Completed"
  console.log('\n--- STEP 2: WAITER MARKS PAYMENT COMPLETED ---');
  updatedOrder.status = 'Completed';
  updatedOrder.paymentStatus = 'Paid';
  await updatedOrder.save();

  // Trigger deduction again (should not double-deduct)
  await deductInventoryForOrder(updatedOrder._id, updatedOrder.cafeId, updatedOrder.items);

  updatedOrder = await Order.findById(order._id);
  almond = await Inventory.findOne({ name: 'Almond Powder' });
  console.log('Order status:', updatedOrder.status, 'paymentStatus:', updatedOrder.paymentStatus, 'inventoryDeducted:', updatedOrder.inventoryDeducted);
  console.log('Almond Powder stock:', almond.quantity, 'grams (Expected: 285)');

  // Clean up test order
  await Order.deleteOne({ _id: order._id });
  console.log('\nCleaned up test order.');

  await mongoose.connection.close();
}

run().catch(console.error);
