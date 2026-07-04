require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected');

  const User = require('../models/User');
  const Cafe = require('../models/Cafe');
  const PaymentConfig = require('../models/PaymentConfig');

  const user = await User.findOne({ email: 'bevarayash@gmail.com' });
  if (!user) {
    console.log('User not found');
    process.exit(0);
  }
  console.log('User cafeId:', user.cafeId);

  const payment = await PaymentConfig.findOne({ cafeId: user.cafeId });
  if (payment) {
    console.log('UPI ID:', payment.upiId);
  } else {
    console.log('PaymentConfig not found');
  }

  process.exit(0);
}

run();
