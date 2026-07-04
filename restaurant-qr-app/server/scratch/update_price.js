const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const MenuItem = require('../models/MenuItem');
  await MenuItem.updateOne({ name: 'Burger&Softdrink' }, { $set: { originalPrice: 250 } });
  
  // Clear menu cache
  const menuCache = require('../utils/menuCache');
  menuCache.clearAll();
  
  console.log('Updated');
  process.exit();
});
