const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });
const WorkReport = require('./models/WorkReport');

async function run() {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Dr. Chai Cafe';
  await mongoose.connect(uri);
  
  const staffIdStr = "6a2a584605afed0ff9b88c39";
  const branchId = "BR002";
  const cafeId = "CD001";
  const date = "2026-06-12";
  
  const query = {
    cafeId,
    staffId: staffIdStr,
    branchId,
    date
  };
  
  console.log("Query:", query);
  const reports = await WorkReport.find(query);
  console.log('TOTAL MATCHING:', reports.length);
  process.exit(0);
}
run();
