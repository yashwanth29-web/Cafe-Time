const mongoose = require('mongoose');
require('dotenv').config({path: '.env'});
const MenuItem = require('./models/MenuItem');

const imageMapping = {
  "Goli Soda": "goli_soda.png",
  "Small Fries": "small_fries.png",
  "Medium Fries": "medium_fries.png",
  "Allam Bellam Tea": "allam_bellam_tea.png",
  "Muska Bun": "muska_bun.png",
  "Regular Tea": "regular_tea.png",
  "Ginger Tea": "ginger_tea.png",
  "Chicken Puff": "chicken_puff.png",
  "Lassi": "lassi.png",
  "Veg Puff": "veg_puff.png",
  "Watermelon Juice": "watermelon_juice.png",
  "Vanilla Milkshake": "vanilla_milkshake.png",
  "Osmaniya Biscuit": "osmaniya_biscuit.png",
  "Egg Puff": "egg_puff.png",
  "Large Fries": "large_fries.png",
  "Hazelnut Milkshake": "hazelnut_milkshake.png",
  "Chocolate Coffee": "chocolate_coffee.png",
  // Fallbacks due to AI generator limit
  "Badam Milk": "lassi.png",
  "Samosa": "veg_puff.png",
  "Cold Coffee": "hazelnut_milkshake.png",
  "Musk Melon Juice": "watermelon_juice.png",
  "Mango Juice": "watermelon_juice.png",
  "Strawberry Milkshake": "vanilla_milkshake.png",
  "Elaichi Tea": "regular_tea.png",
  "Chocolate Milkshake": "hazelnut_milkshake.png",
  "Black Tea": "regular_tea.png",
  "Classic Coffee": "chocolate_coffee.png",
  "Veg Sandwich": "muska_bun.png"
};

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/cafe_manager')
  .then(async () => {
    console.log('Connected to MongoDB.');
    let updatedCount = 0;
    
    for (const [name, imgFile] of Object.entries(imageMapping)) {
      const result = await MenuItem.updateMany(
        { name: name },
        { $set: { image: `/uploads/${imgFile}` } }
      );
      if (result.modifiedCount > 0) {
        console.log(`Updated ${name} to use ${imgFile}`);
        updatedCount += result.modifiedCount;
      }
    }
    
    console.log(`Successfully updated ${updatedCount} menu items!`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error connecting to MongoDB:', err);
    process.exit(1);
  });
