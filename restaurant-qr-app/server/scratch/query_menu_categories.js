const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MenuItemSchema = new mongoose.Schema({}, { strict: false });
const MenuItem = mongoose.model('MenuItem', MenuItemSchema, 'menuitems');

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  await mongoose.connect(uri);

  const items = await MenuItem.find({});
  
  // Sort items by Category (alphabetical) then Name (alphabetical)
  items.sort((a, b) => {
    const catA = (a.category || '').toLowerCase();
    const catB = (b.category || '').toLowerCase();
    if (catA < catB) return -1;
    if (catA > catB) return 1;
    
    const nameA = (a.name || '').toLowerCase();
    const nameB = (b.name || '').toLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return 0;
  });

  console.log('--- SORTED MENU ITEMS ---');
  items.forEach((item, index) => {
    console.log(`${index + 1}. [${item.category}] ${item.name} (Current Image: ${item.image})`);
  });

  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
