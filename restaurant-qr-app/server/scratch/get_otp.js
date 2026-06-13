const mongoose = require('mongoose');
const OtpVerification = require('../models/OtpVerification');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const otpRecord = await OtpVerification.findOne({ email: 'kamalabevara@gmail.com' });
    if (otpRecord) {
      console.log('--- DB OTP RECORD ---');
      console.log('Email:', otpRecord.email);
      console.log('OTP:', otpRecord.otp);
      console.log('Expires:', otpRecord.expiresAt);
      console.log('---------------------');
    } else {
      console.log('No OTP record found for kamalabevara@gmail.com');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.connection.close();
  }
}
run();
