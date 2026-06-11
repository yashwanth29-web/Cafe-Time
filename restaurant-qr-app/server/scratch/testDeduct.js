const mongoose = require('mongoose');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const { deductInventoryForOrder } = require('../controllers/inventoryController');
  const Order = require('../models/Order');

  const orderId = '6a2a6dce5b9b4bdf391eb6ad';
  const order = await Order.findById(orderId);
  console.log('Order to test:', order);

  console.log('Running deductInventoryForOrder...');
  // Temporarily reset inventoryDeducted to false to test
  order.inventoryDeducted = false;
  await order.save();

  await deductInventoryForOrder(order._id, order.cafeId, order.items);

  const updatedOrder = await Order.findById(orderId);
  console.log('After running, inventoryDeducted:', updatedOrder.inventoryDeducted);

  const Almond = require('../models/Inventory');
  const almond = await Almond.findOne({ name: 'Almond Powder' });
  console.log('Almond Powder quantity after test:', almond.quantity);

  await mongoose.connection.close();
}

test().catch(console.error);
