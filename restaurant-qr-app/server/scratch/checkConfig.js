const mongoose = require('mongoose');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const OperationalConfig = require('../models/OperationalConfig');
  const Inventory = require('../models/Inventory');
  const Order = require('../models/Order');

  const configs = await OperationalConfig.find({});
  console.log('OperationalConfigs:', JSON.stringify(configs, null, 2));

  const almond = await Inventory.findOne({ name: 'Almond Powder' });
  console.log('Almond Powder inventory item:', almond);

  const orders = await Order.find({}).sort({ createdAt: -1 }).limit(5);
  console.log('Latest 5 orders:', orders.map(o => ({ id: o._id, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod, inventoryDeducted: o.inventoryDeducted })));

  await mongoose.connection.close();
}

check().catch(console.error);
