const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Dr. Chai Cafe';
  await mongoose.connect(uri);
  const db = mongoose.connection;
  const users = await db.collection('users').find({ name: 'harsha' }).toArray();
  console.log(JSON.stringify(users, null, 2));
  process.exit(0);
}
run();
