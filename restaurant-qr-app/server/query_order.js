const mongoose = require('mongoose');
const Order = require('./models/Order');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    const orderId = '6a2a632505afed0ff9b8a2b8';
    const order = await Order.findById(orderId);
    if (!order) {
      console.log('Order not found in DB:', orderId);
      return;
    }

    console.log('Found Order details:', JSON.stringify(order, null, 2));

    // Test a local update and run Mongoose validators
    order.paymentMethod = 'Counter';
    try {
      await order.validate();
      console.log('Validation passed locally!');
    } catch (valErr) {
      console.error('Validation FAILED locally:', valErr.message);
    }

  } catch (err) {
    console.error('Database connection / query error:', err);
  } finally {
    await mongoose.connection.close();
  }
}

run();
