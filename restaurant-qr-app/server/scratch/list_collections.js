const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to database:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('--- COLLECTIONS ---');
  console.log(collections.map(c => c.name));

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
