const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const fixInventory = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/Dr. Chai Cafe';
  await mongoose.connect(uri);

  const Inventory = require('../models/Inventory');
  const items = await Inventory.find({});
  console.log(`Found ${items.length} total inventory items in the database.`);

  let fixCount = 0;
  for (const item of items) {
    let needsSave = false;

    // Check and fix stock field
    if (item.stock !== item.quantity) {
      item.stock = item.quantity;
      needsSave = true;
    }

    // Check and fix minStock field
    if (item.minStock !== item.reorderLevel) {
      item.minStock = item.reorderLevel;
      needsSave = true;
    }

    // Check and fix cost field
    if (item.cost !== item.costPrice) {
      item.cost = item.costPrice;
      needsSave = true;
    }

    if (needsSave) {
      await item.save();
      fixCount++;
    }
  }

  console.log(`Successfully repaired ${fixCount} inventory items with missing/mismatching fields.`);
  await mongoose.disconnect();
};

fixInventory().catch(err => {
  console.error(err);
  process.exit(1);
});
