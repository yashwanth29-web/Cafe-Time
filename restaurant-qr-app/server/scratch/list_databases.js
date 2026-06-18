const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to database:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const admin = mongoose.connection.db.admin();
  const dbs = await admin.listDatabases();
  console.log('--- DATABASES ---');
  console.log(dbs.databases);

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
