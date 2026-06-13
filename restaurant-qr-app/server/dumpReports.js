const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const WorkReport = require('./models/WorkReport');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  await mongoose.connect(uri);
  const reports = await WorkReport.find({});
  console.log('TOTAL REPORTS:', reports.length);
  if (reports.length > 0) {
    console.log(JSON.stringify(reports, null, 2));
  }
  process.exit(0);
}
run();
