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
  
  const upiId = '9346540919@ybl';
  
  let payment = await PaymentConfig.findOne({ cafeId: user.cafeId });
  if (payment) {
    payment.upiId = upiId;
    await payment.save();
    console.log('Updated existing PaymentConfig');
  } else {
    payment = new PaymentConfig({
      cafeId: user.cafeId,
      upiId: upiId
    });
    await payment.save();
    console.log('Created new PaymentConfig');
  }

  console.log('UPI ID set to:', payment.upiId, 'for cafe:', user.cafeId);
  process.exit(0);
}

run();
