const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/coffeeday').then(async () => {
  const db = mongoose.connection.db;
  await db.collection('menuitems').updateOne({ name: 'Burger&Softdrink' }, { $set: { originalPrice: 216 } });
  console.log('Updated combo in MongoDB!');
  process.exit(0);
});
