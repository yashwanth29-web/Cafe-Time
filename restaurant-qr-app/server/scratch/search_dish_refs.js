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
  const collections = await conn.db.listCollections().toArray();

  for (const col of collections) {
    const name = col.name;
    const count = await conn.db.collection(name).countDocuments({
      $or: [
        { image: { $regex: 'dish-' } },
        { imageUrl: { $regex: 'dish-' } },
        { images: { $regex: 'dish-' } },
        { 'items.image': { $regex: 'dish-' } },
        { 'items.imageUrl': { $regex: 'dish-' } }
      ]
    });
    if (count > 0) {
      console.log(`Found ${count} matches in collection: ${name}`);
      const sample = await conn.db.collection(name).find({
        $or: [
          { image: { $regex: 'dish-' } },
          { imageUrl: { $regex: 'dish-' } },
          { images: { $regex: 'dish-' } },
          { 'items.image': { $regex: 'dish-' } },
          { 'items.imageUrl': { $regex: 'dish-' } }
        ]
      }).limit(5).toArray();
      console.log(JSON.stringify(sample, null, 2));
    }
  }

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
