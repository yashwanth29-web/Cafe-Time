const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to database:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const conn = mongoose.connection;
  const item = await conn.db.collection('menuitems').findOne({});
  console.log('--- RAW MENU ITEM ---');
  console.log(item);

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
