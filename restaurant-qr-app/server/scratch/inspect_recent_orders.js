const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const inspect = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  await mongoose.connect(uri);

  const Order = require('../models/Order');
  // Find last 5 orders
  const orders = await Order.find({}).sort({ createdAt: -1 }).limit(5);
  console.log('--- RECENT ORDERS ---');
  console.log(JSON.stringify(orders.map(o => ({
    _id: o._id,
    tableNumber: o.tableNumber,
    cafeId: o.cafeId,
    source: o.source,
    status: o.status,
    createdAt: o.createdAt
  })), null, 2));

  await mongoose.disconnect();
};

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
