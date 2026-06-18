const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MenuItemSchema = new mongoose.Schema({}, { strict: false });
const MenuItem = mongoose.model('MenuItem', MenuItemSchema, 'menuitems');

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to database:', uri);
  await mongoose.connect(uri);
  console.log('Connected!');

  const items = await MenuItem.find({});
  console.log('--- MENU ITEMS ---');
  console.log(JSON.stringify(items.map(item => ({
    _id: item._id,
    name: item.name,
    image: item.image,
    imageUrl: item.imageUrl,
    images: item.images
  })), null, 2));

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
