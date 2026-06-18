const mongoose = require('mongoose');

const run = async () => {
  const uri = 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to local database:', uri);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    console.log('Connected!');

    const conn = mongoose.connection;
    const items = await conn.db.collection('menuitems').find({}).toArray();
    console.log('--- LOCAL MENU ITEMS ---');
    console.log(JSON.stringify(items.map(item => ({
      _id: item._id,
      name: item.name,
      image: item.image
    })), null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error('Failed to connect to local database:', err.message);
  }
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
