const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Dr. Chai Cafe';
  await mongoose.connect(uri);
  const db = mongoose.connection;
  const reports = await db.collection('workreports').find({}).toArray();
  if (reports.length > 0) {
    console.log("Type of staffId:", typeof reports[0].staffId, reports[0].staffId.constructor.name);
  }
  process.exit(0);
}
run();
