const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const updates = [
  { name: 'Chocolate Coffee', path: '/uploads/dish-1781538489823-67122816.jpg' },
  { name: 'Classic Coffee', path: '/uploads/dish-1781538504134-261896466.jpg' },
  { name: 'Cold Coffee', path: '/uploads/dish-1781538532243-319866540.jpg' },
  { name: 'Large Fries', path: '/uploads/dish-1781538572428-867716580.jpg' },
  { name: 'Medium Fries', path: '/uploads/dish-1781538583872-991399356.jpg' },
  { name: 'Small Fries', path: '/uploads/dish-1781538551607-692596989.jpg' },
  { name: 'Badam Milk', path: '/uploads/dish-1781538596912-619275300.jpg' },
  { name: 'Goli Soda', path: '/uploads/dish-1781538609444-803534232.jpg' },
  { name: 'Lassi', path: '/uploads/dish-1781538623899-829667631.jpg' },
  { name: 'Mango Juice', path: '/uploads/dish-1781538636193-67419414.jpg' },
  { name: 'Musk Melon Juice', path: '/uploads/dish-1781538653229-393732266.jpg' },
  { name: 'Watermelon Juice', path: '/uploads/dish-1781538666666-290059000.jpg' },
  { name: 'Allam Bellam Tea', path: '/uploads/dish-1781538685869-84331898.jpg' },
  { name: 'Black Tea', path: '/uploads/dish-1781538698287-868401230.jpg' },
  { name: 'Elaichi Tea', path: '/uploads/dish-1781538709856-569433373.jpg' },
  { name: 'Ginger Tea', path: '/uploads/dish-1781538724411-761824673.jpg' },
  { name: 'Chicken Puff', path: '/uploads/dish-1781538753797-477396917.jpg' },
  { name: 'Egg Puff', path: '/uploads/dish-1781538785540-199900804.jpg' },
  { name: 'Muska Bun', path: '/uploads/dish-1781538799714-892715440.jpg' },
  { name: 'Osmaniya Biscuit', path: '/uploads/dish-1781538814093-704947995.jpg' },
  { name: 'Samosa', path: '/uploads/dish-1781538826877-17461220.jpg' },
  { name: 'Veg Puff', path: '/uploads/dish-1781538851249-109081348.jpg' },
  { name: 'Chocolate Milkshake', path: '/uploads/dish-1781538878545-434709465.jpg' },
  { name: 'Strawberry Milkshake', path: '/uploads/dish-1781538932366-308263508.jpg' },
  { name: 'Vanilla Milkshake', path: '/uploads/dish-1781538961827-222484261.jpg' }
];

const run = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/coffeedaycafe';
  console.log('Connecting to database...');
  await mongoose.connect(uri);
  const conn = mongoose.connection;
  console.log('Connected!');

  console.log('Updating high-confidence records...');
  for (const item of updates) {
    const res = await conn.db.collection('menuitems').updateOne(
      { name: item.name },
      { $set: { image: item.path } }
    );
    console.log(`Updated "${item.name}": set path to "${item.path}" (modified: ${res.modifiedCount})`);
  }

  console.log('All high-confidence database updates completed successfully!');
  await mongoose.disconnect();
};

run().catch(err => {
  console.error('Error during database update:', err);
  process.exit(1);
});
