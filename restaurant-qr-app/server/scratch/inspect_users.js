const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const inspect = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  await mongoose.connect(uri);

  const User = require('../models/User');
  const users = await User.find({});
  console.log('--- REGISTERED USERS ---');
  console.log(JSON.stringify(users.map(u => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    cafeId: u.cafeId
  })), null, 2));

  await mongoose.disconnect();
};

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
