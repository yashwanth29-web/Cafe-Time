const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const inspect = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  await mongoose.connect(uri);

  const Cafe = require('../models/Cafe');
  const cafes = await Cafe.find({});
  console.log('--- CAFES ---');
  console.log(JSON.stringify(cafes.map(c => ({
    _id: c._id,
    name: c.name,
    cafeId: c.cafeId
  })), null, 2));

  await mongoose.disconnect();
};

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
