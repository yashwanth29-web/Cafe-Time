const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Cafe = require('./models/Cafe');
const Branch = require('./models/Branch');
const Attendance = require('./models/Attendance');

const inspect = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to database:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const users = await User.find({});
  console.log('--- USERS ---');
  console.log(JSON.stringify(users.map(u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, assignedBranch: u.assignedBranch, cafeId: u.cafeId })), null, 2));

  const cafes = await Cafe.find({});
  console.log('--- CAFES ---');
  console.log(JSON.stringify(cafes, null, 2));

  const branches = await Branch.find({});
  console.log('--- BRANCHES ---');
  console.log(JSON.stringify(branches.map(b => ({ _id: b._id, branchId: b.branchId, branchName: b.branchName, cafeId: b.cafeId, latitude: b.latitude, longitude: b.longitude, allowedRadius: b.allowedRadius, isActive: b.isActive })), null, 2));

  const attendance = await Attendance.find({});
  console.log('--- ATTENDANCE ---');
  console.log(JSON.stringify(attendance, null, 2));

  await mongoose.disconnect();
};

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
