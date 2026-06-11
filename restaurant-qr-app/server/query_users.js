const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    const users = await User.find();
    console.log('Users found:', JSON.stringify(users.map(u => ({ id: u._id, email: u.email, role: u.role })), null, 2));

  } catch (err) {
    console.error('Database connection / query error:', err);
  } finally {
    await mongoose.connection.close();
  }
}

run();
