const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const categoryOrderedItems = [
  'Regular Tea',
  'Black Tea',
  'Elaichi Tea',
  'Ginger Tea',
  'Allam Bellam Tea',
  'Classic Coffee',
  'Chocolate Coffee',
  'Cold Coffee',
  'Goli Soda',
  'Badam Milk',
  'Watermelon Juice',
  'Musk Melon Juice',
  'Lassi',
  'Mango Juice',
  'Chocolate Milkshake',
  'Vanilla Milkshake',
  'Strawberry Milkshake',
  'Hazelnut Milkshake',
  'Osmaniya Biscuit',
  'Veg Puff',
  'Egg Puff',
  'Chicken Puff',
  'Muska Bun',
  'Samosa',
  'Veg Sandwich',
  'Small Fries',
  'Medium Fries',
  'Large Fries'
];

const run = async () => {
  const uploadsDir = path.join(__dirname, '../public/uploads');
  const files = fs.readdirSync(uploadsDir);
  
  const scannedFiles = files.map(f => {
    const p = path.join(uploadsDir, f);
    const stat = fs.statSync(p);
    return {
      filename: f,
      createdAt: stat.mtime.toISOString()
    };
  });

  const dishFiles = scannedFiles
    .filter(f => f.filename.startsWith('dish-') && f.filename.includes('1781538'))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to database...');
  await mongoose.connect(uri);
  const conn = mongoose.connection;

  console.log('Starting database updates...');
  for (let i = 0; i < categoryOrderedItems.length; i++) {
    const name = categoryOrderedItems[i];
    const filename = dishFiles[i] ? `dish-${dishFiles[i].filename.split('dish-')[1]}` : null;
    if (!filename) {
      console.warn(`No matching image file for item: ${name}`);
      continue;
    }
    const relativePath = `/uploads/${filename}`;
    
    const res = await conn.db.collection('menuitems').updateOne(
      { name: name },
      { $set: { image: relativePath } }
    );
    console.log(`Updated "${name}": matched to ${relativePath} (matchedCount: ${res.matchedCount}, modifiedCount: ${res.modifiedCount})`);
  }

  console.log('All database updates completed!');
  await mongoose.disconnect();
};

run().catch(err => {
  console.error(err);
  process.exit(1);
});
