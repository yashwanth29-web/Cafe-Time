const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/coffeeday').then(async () => {
  const db = mongoose.connection.db;
  await db.collection('menuitems').updateOne(
    { name: 'Burger&Softdrink' }, 
    { $set: { originalPrice: 216, isCombo: true, category: 'Combos' } }
  );
  console.log('Fixed combo completely!');
  process.exit(0);
});
