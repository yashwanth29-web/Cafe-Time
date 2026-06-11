/**
 * ONE-TIME CLOUD SEED SCRIPT
 * Pushes all menu items + inventory to MongoDB Atlas directly.
 * Run once with: node config/pushToCloud.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

const MenuItem        = require('../models/MenuItem');
const Category        = require('../models/Category');
const Inventory       = require('../models/Inventory');
const InventoryCategory = require('../models/InventoryCategory');

// ─────────────────────────────────────────────
// 1. MENU CATEGORIES
// ─────────────────────────────────────────────
const menuCategories = [
  { name: 'Signature Chai',       cafeId: 'CD001' },
  { name: 'Coffee Selection',     cafeId: 'CD001' },
  { name: 'Fresh Juices & Coolers', cafeId: 'CD001' },
  { name: 'Thick Milkshakes',     cafeId: 'CD001' },
  { name: 'Starters & Bites',     cafeId: 'CD001' },
  { name: 'French Fries',         cafeId: 'CD001' },
];

// ─────────────────────────────────────────────
// 2. ALL 28 MENU ITEMS
// ─────────────────────────────────────────────
const menuItems = [
  // ── Signature Chai ──
  { name: 'Regular Tea', price: 20, category: 'Signature Chai', available: true, image: '/images/default-food.png', description: 'Traditional regular chai brewed to perfection with fresh milk and tea leaves.', preparationTime: 5, recipe: [{ name: 'Tea Leaves', quantity: 10 }, { name: 'Milk', quantity: 100 }, { name: 'Sugar', quantity: 8 }] },
  { name: 'Black Tea',   price: 15, category: 'Signature Chai', available: true, image: '/images/default-food.png', description: 'Strong, revitalizing black tea brewed without milk.', preparationTime: 4, recipe: [{ name: 'Tea Leaves', quantity: 10 }, { name: 'Sugar', quantity: 8 }] },
  { name: 'Elaichi Tea', price: 25, category: 'Signature Chai', available: true, image: '/images/default-food.png', description: 'Fragrant cardamom-infused Indian milk chai.', preparationTime: 5, recipe: [{ name: 'Tea Leaves', quantity: 10 }, { name: 'Milk', quantity: 100 }, { name: 'Sugar', quantity: 8 }, { name: 'Cardamom', quantity: 2 }] },
  { name: 'Ginger Tea',  price: 25, category: 'Signature Chai', available: true, image: '/images/default-food.png', description: 'Warm and spicy ginger milk tea, great for throat relief.', preparationTime: 5, recipe: [{ name: 'Tea Leaves', quantity: 10 }, { name: 'Milk', quantity: 100 }, { name: 'Sugar', quantity: 8 }, { name: 'Ginger', quantity: 5 }] },
  { name: 'Allam Bellam Tea', price: 30, category: 'Signature Chai', available: true, image: '/images/default-food.png', description: 'Traditional ginger and organic jaggery tea (Bellam). No refined sugar.', preparationTime: 6, recipe: [{ name: 'Tea Leaves', quantity: 10 }, { name: 'Milk', quantity: 100 }, { name: 'Jaggery', quantity: 10 }, { name: 'Ginger', quantity: 5 }] },

  // ── Coffee Selection ──
  { name: 'Classic Coffee',    price: 30, category: 'Coffee Selection', available: true, image: '/images/default-food.png', description: 'Traditional rich aromatic hot coffee.', preparationTime: 5, recipe: [{ name: 'Coffee Powder', quantity: 15 }, { name: 'Milk', quantity: 200 }, { name: 'Sugar', quantity: 10 }] },
  { name: 'Chocolate Coffee',  price: 40, category: 'Coffee Selection', available: true, image: '/images/default-food.png', description: 'Rich coffee brewed with steamed milk and a swirl of chocolate syrup.', preparationTime: 6, recipe: [{ name: 'Coffee Powder', quantity: 15 }, { name: 'Milk', quantity: 200 }, { name: 'Sugar', quantity: 10 }, { name: 'Chocolate Syrup', quantity: 20 }] },
  { name: 'Cold Coffee',       price: 50, category: 'Coffee Selection', available: true, image: '/images/default-food.png', description: 'Creamy chilled coffee blended with ice cream and milk.', preparationTime: 7, recipe: [{ name: 'Coffee Powder', quantity: 15 }, { name: 'Milk', quantity: 250 }, { name: 'Sugar', quantity: 15 }, { name: 'Ice Cream', quantity: 50 }] },

  // ── Fresh Juices & Coolers ──
  { name: 'Goli Soda',       price: 25, category: 'Fresh Juices & Coolers', available: true, image: '/images/default-food.png', description: 'Classic Indian street-style lemon soda bottle cooler.', preparationTime: 3, recipe: [{ name: 'Lemon Juice', quantity: 15 }, { name: 'Soda Water', quantity: 250 }, { name: 'Sugar Syrup', quantity: 20 }] },
  { name: 'Badam Milk',      price: 40, category: 'Fresh Juices & Coolers', available: true, image: '/images/default-food.png', description: 'Chilled rich almond flavored milk with cardamom.', preparationTime: 3, recipe: [{ name: 'Milk', quantity: 200 }, { name: 'Almond Powder', quantity: 15 }, { name: 'Sugar', quantity: 10 }] },
  { name: 'Watermelon Juice', price: 40, category: 'Fresh Juices & Coolers', available: true, image: '/images/default-food.png', description: 'Freshly blended sweet watermelon juice, fully refreshing.', preparationTime: 5, recipe: [{ name: 'Watermelon Fruit', quantity: 200 }, { name: 'Sugar Syrup', quantity: 10 }] },
  { name: 'Musk Melon Juice', price: 45, category: 'Fresh Juices & Coolers', available: true, image: '/images/default-food.png', description: 'Thick, creamy musk melon juice freshly blended.', preparationTime: 5, recipe: [{ name: 'Musk Melon Fruit', quantity: 200 }, { name: 'Sugar Syrup', quantity: 15 }] },
  { name: 'Lassi',           price: 40, category: 'Fresh Juices & Coolers', available: true, image: '/images/default-food.png', description: 'Sweet Punjabi style thick churned yogurt lassi.', preparationTime: 4, recipe: [{ name: 'Curd', quantity: 150 }, { name: 'Sugar', quantity: 20 }, { name: 'Milk', quantity: 50 }] },
  { name: 'Mango Juice',     price: 50, category: 'Fresh Juices & Coolers', available: true, image: '/images/default-food.png', description: 'Thick pulpy sweet mango juice.', preparationTime: 4, recipe: [{ name: 'Mango Pulp', quantity: 100 }, { name: 'Milk', quantity: 100 }, { name: 'Sugar', quantity: 10 }] },

  // ── Thick Milkshakes ──
  { name: 'Chocolate Milkshake',  price: 60, category: 'Thick Milkshakes', available: true, image: '/images/default-food.png', description: 'Thick, indulgent double chocolate milkshake.', preparationTime: 6, recipe: [{ name: 'Milk', quantity: 200 }, { name: 'Chocolate Syrup', quantity: 30 }, { name: 'Ice Cream', quantity: 50 }] },
  { name: 'Vanilla Milkshake',    price: 55, category: 'Thick Milkshakes', available: true, image: '/images/default-food.png', description: 'Creamy vanilla milkshake blended with premium vanilla ice cream.', preparationTime: 5, recipe: [{ name: 'Milk', quantity: 200 }, { name: 'Vanilla Essence', quantity: 5 }, { name: 'Ice Cream', quantity: 50 }] },
  { name: 'Strawberry Milkshake', price: 60, category: 'Thick Milkshakes', available: true, image: '/images/default-food.png', description: 'Creamy sweet strawberry milkshake.', preparationTime: 5, recipe: [{ name: 'Milk', quantity: 200 }, { name: 'Strawberry Syrup', quantity: 30 }, { name: 'Ice Cream', quantity: 50 }] },
  { name: 'Hazelnut Milkshake',   price: 70, category: 'Thick Milkshakes', available: true, image: '/images/default-food.png', description: 'Decadent thick milkshake with roasted hazelnut notes.', preparationTime: 6, recipe: [{ name: 'Milk', quantity: 200 }, { name: 'Hazelnut Syrup', quantity: 25 }, { name: 'Ice Cream', quantity: 50 }] },

  // ── Starters & Bites ──
  { name: 'Osmaniya Biscuit', price: 10, category: 'Starters & Bites', available: true, image: '/images/default-food.png', description: 'Authentic sweet & salty Hyderabadi tea biscuit.', preparationTime: 2, recipe: [{ name: 'Biscuit Pack', quantity: 1 }] },
  { name: 'Veg Puff',         price: 25, category: 'Starters & Bites', available: true, image: '/images/default-food.png', description: 'Crispy flaky puff stuffed with seasoned potatoes, carrots & peas.', preparationTime: 5, recipe: [{ name: 'Veg Puff Raw', quantity: 1 }] },
  { name: 'Egg Puff',         price: 30, category: 'Starters & Bites', available: true, image: '/images/default-food.png', description: 'Crispy pastry folded around half a hardboiled egg and spiced masala.', preparationTime: 5, recipe: [{ name: 'Egg Puff Raw', quantity: 1 }] },
  { name: 'Chicken Puff',     price: 35, category: 'Starters & Bites', available: true, image: '/images/default-food.png', description: 'Flaky baked pastry filled with tender spiced shredded chicken.', preparationTime: 5, recipe: [{ name: 'Chicken Puff Raw', quantity: 1 }] },
  { name: 'Muska Bun',        price: 30, category: 'Starters & Bites', available: true, image: '/images/default-food.png', description: 'Fresh soft sweet bun sliced and packed with unsalted butter and fresh cream.', preparationTime: 3, recipe: [{ name: 'Bun', quantity: 1 }, { name: 'Butter', quantity: 20 }] },
  { name: 'Samosa',           price: 15, category: 'Starters & Bites', available: true, image: '/images/default-food.png', description: 'Crispy golden fried triangle potato-peas samosa.', preparationTime: 5, recipe: [{ name: 'Samosa Raw', quantity: 1 }] },
  { name: 'Veg Sandwich',     price: 45, category: 'Starters & Bites', available: true, image: '/images/default-food.png', description: 'Grilled sandwich with cucumber, tomato, potato mash, and mint chutney.', preparationTime: 8, recipe: [{ name: 'Bread Slices', quantity: 2 }, { name: 'Butter', quantity: 10 }, { name: 'Cucumber', quantity: 20 }, { name: 'Tomato', quantity: 20 }] },

  // ── French Fries ──
  { name: 'Small Fries',  price: 40, category: 'French Fries', available: true, image: '/images/default-food.png', description: 'Crispy salted golden french fries (Small size).',  preparationTime: 5, recipe: [{ name: 'Potato Fries Raw', quantity: 100 }, { name: 'Salt', quantity: 5 }] },
  { name: 'Medium Fries', price: 60, category: 'French Fries', available: true, image: '/images/default-food.png', description: 'Crispy salted golden french fries (Medium size).', preparationTime: 5, recipe: [{ name: 'Potato Fries Raw', quantity: 150 }, { name: 'Salt', quantity: 8 }] },
  { name: 'Large Fries',  price: 80, category: 'French Fries', available: true, image: '/images/default-food.png', description: 'Crispy salted golden french fries (Large size).',  preparationTime: 5, recipe: [{ name: 'Potato Fries Raw', quantity: 200 }, { name: 'Salt', quantity: 10 }] },
];

// ─────────────────────────────────────────────
// 3. INVENTORY CATEGORIES
// ─────────────────────────────────────────────
const inventoryCategories = [
  { name: 'Chai Ingredients',   cafeId: 'CD001' },
  { name: 'Coffee Ingredients', cafeId: 'CD001' },
  { name: 'Juice & Coolers',    cafeId: 'CD001' },
  { name: 'Milkshake Syrups',   cafeId: 'CD001' },
  { name: 'Bakery & Snacks',    cafeId: 'CD001' },
  { name: 'Fries & Basics',     cafeId: 'CD001' },
];

// ─────────────────────────────────────────────
// 4. ALL 31 INVENTORY ITEMS
// ─────────────────────────────────────────────
const inventoryItems = [
  // Chai Ingredients
  { cafeId: 'CD001', name: 'Tea Leaves',     quantity: 500,  unit: 'grams',  costPrice: 2,   sellingPrice: 0, reorderLevel: 100, category: 'Chai Ingredients',   supplier: 'Local Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Milk',           quantity: 5000, unit: 'ml',     costPrice: 0.05, sellingPrice: 0, reorderLevel: 1000, category: 'Chai Ingredients',  supplier: 'Dairy Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Sugar',          quantity: 2000, unit: 'grams',  costPrice: 0.04, sellingPrice: 0, reorderLevel: 500,  category: 'Chai Ingredients',  supplier: 'Local Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Cardamom',       quantity: 100,  unit: 'grams',  costPrice: 1.5,  sellingPrice: 0, reorderLevel: 20,   category: 'Chai Ingredients',  supplier: 'Spice Store',    branch: 'Main' },
  { cafeId: 'CD001', name: 'Ginger',         quantity: 300,  unit: 'grams',  costPrice: 0.2,  sellingPrice: 0, reorderLevel: 50,   category: 'Chai Ingredients',  supplier: 'Local Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Jaggery',        quantity: 500,  unit: 'grams',  costPrice: 0.08, sellingPrice: 0, reorderLevel: 100,  category: 'Chai Ingredients',  supplier: 'Local Supplier', branch: 'Main' },

  // Coffee Ingredients
  { cafeId: 'CD001', name: 'Coffee Powder',  quantity: 500,  unit: 'grams',  costPrice: 1.2,  sellingPrice: 0, reorderLevel: 100,  category: 'Coffee Ingredients', supplier: 'Coffee Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Chocolate Syrup', quantity: 1000, unit: 'ml',    costPrice: 0.3,  sellingPrice: 0, reorderLevel: 200,  category: 'Coffee Ingredients', supplier: 'Food Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Ice Cream',      quantity: 2000, unit: 'grams',  costPrice: 0.5,  sellingPrice: 0, reorderLevel: 300,  category: 'Coffee Ingredients', supplier: 'Dairy Supplier', branch: 'Main' },

  // Juice & Coolers
  { cafeId: 'CD001', name: 'Lemon Juice',    quantity: 500,  unit: 'ml',     costPrice: 0.1,  sellingPrice: 0, reorderLevel: 100,  category: 'Juice & Coolers',   supplier: 'Local Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Soda Water',     quantity: 5000, unit: 'ml',     costPrice: 0.02, sellingPrice: 0, reorderLevel: 500,  category: 'Juice & Coolers',   supplier: 'Beverage Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Sugar Syrup',    quantity: 1000, unit: 'ml',     costPrice: 0.05, sellingPrice: 0, reorderLevel: 200,  category: 'Juice & Coolers',   supplier: 'Local Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Almond Powder',  quantity: 300,  unit: 'grams',  costPrice: 1.0,  sellingPrice: 0, reorderLevel: 50,   category: 'Juice & Coolers',   supplier: 'Dry Fruits Store', branch: 'Main' },
  { cafeId: 'CD001', name: 'Watermelon Fruit', quantity: 5000, unit: 'grams', costPrice: 0.01, sellingPrice: 0, reorderLevel: 500, category: 'Juice & Coolers',   supplier: 'Fruit Market', branch: 'Main' },
  { cafeId: 'CD001', name: 'Musk Melon Fruit', quantity: 3000, unit: 'grams', costPrice: 0.02, sellingPrice: 0, reorderLevel: 500, category: 'Juice & Coolers',   supplier: 'Fruit Market', branch: 'Main' },
  { cafeId: 'CD001', name: 'Curd',           quantity: 2000, unit: 'grams',  costPrice: 0.04, sellingPrice: 0, reorderLevel: 300,  category: 'Juice & Coolers',   supplier: 'Dairy Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Mango Pulp',     quantity: 2000, unit: 'ml',     costPrice: 0.1,  sellingPrice: 0, reorderLevel: 300,  category: 'Juice & Coolers',   supplier: 'Food Supplier', branch: 'Main' },

  // Milkshake Syrups
  { cafeId: 'CD001', name: 'Vanilla Essence',  quantity: 200, unit: 'ml',   costPrice: 0.5,  sellingPrice: 0, reorderLevel: 30,   category: 'Milkshake Syrups',  supplier: 'Food Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Strawberry Syrup', quantity: 1000, unit: 'ml',  costPrice: 0.25, sellingPrice: 0, reorderLevel: 150,  category: 'Milkshake Syrups',  supplier: 'Food Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Hazelnut Syrup',   quantity: 1000, unit: 'ml',  costPrice: 0.4,  sellingPrice: 0, reorderLevel: 150,  category: 'Milkshake Syrups',  supplier: 'Food Supplier', branch: 'Main' },

  // Bakery & Snacks
  { cafeId: 'CD001', name: 'Biscuit Pack',     quantity: 50,  unit: 'packs', costPrice: 8,   sellingPrice: 0, reorderLevel: 10,   category: 'Bakery & Snacks',   supplier: 'Bakery Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Veg Puff Raw',     quantity: 50,  unit: 'pieces', costPrice: 12,  sellingPrice: 0, reorderLevel: 10,  category: 'Bakery & Snacks',   supplier: 'Bakery Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Egg Puff Raw',     quantity: 50,  unit: 'pieces', costPrice: 14,  sellingPrice: 0, reorderLevel: 10,  category: 'Bakery & Snacks',   supplier: 'Bakery Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Chicken Puff Raw', quantity: 50,  unit: 'pieces', costPrice: 18,  sellingPrice: 0, reorderLevel: 10,  category: 'Bakery & Snacks',   supplier: 'Bakery Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Bun',              quantity: 100, unit: 'pieces', costPrice: 5,   sellingPrice: 0, reorderLevel: 20,  category: 'Bakery & Snacks',   supplier: 'Bakery Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Butter',           quantity: 500, unit: 'grams', costPrice: 0.5,  sellingPrice: 0, reorderLevel: 100,  category: 'Bakery & Snacks',   supplier: 'Dairy Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Samosa Raw',       quantity: 100, unit: 'pieces', costPrice: 6,   sellingPrice: 0, reorderLevel: 20,  category: 'Bakery & Snacks',   supplier: 'Bakery Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Bread Slices',     quantity: 200, unit: 'slices', costPrice: 1.5, sellingPrice: 0, reorderLevel: 30,  category: 'Bakery & Snacks',   supplier: 'Bakery Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Cucumber',         quantity: 1000, unit: 'grams', costPrice: 0.02, sellingPrice: 0, reorderLevel: 150, category: 'Bakery & Snacks',  supplier: 'Vegetable Market', branch: 'Main' },
  { cafeId: 'CD001', name: 'Tomato',           quantity: 1000, unit: 'grams', costPrice: 0.02, sellingPrice: 0, reorderLevel: 150, category: 'Bakery & Snacks',  supplier: 'Vegetable Market', branch: 'Main' },

  // Fries & Basics
  { cafeId: 'CD001', name: 'Potato Fries Raw', quantity: 5000, unit: 'grams', costPrice: 0.03, sellingPrice: 0, reorderLevel: 500, category: 'Fries & Basics',   supplier: 'Food Supplier', branch: 'Main' },
  { cafeId: 'CD001', name: 'Salt',             quantity: 1000, unit: 'grams', costPrice: 0.01, sellingPrice: 0, reorderLevel: 100, category: 'Fries & Basics',   supplier: 'Local Supplier', branch: 'Main' },
];

// ─────────────────────────────────────────────
// 5. MAIN PUSH FUNCTION
// ─────────────────────────────────────────────
const pushToCloud = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI not found in .env!');

    console.log('\n🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log('✅ Connected to Atlas successfully!\n');

    // ── Menu Categories ──
    console.log('📂 Clearing old menu categories...');
    await Category.deleteMany({});
    await Category.insertMany(menuCategories);
    console.log(`✅ ${menuCategories.length} Menu Categories inserted!\n`);

    // ── Menu Items ──
    console.log('🍽️  Clearing old menu items...');
    await MenuItem.deleteMany({});
    await MenuItem.insertMany(menuItems);
    console.log(`✅ ${menuItems.length} Menu Items inserted!\n`);

    // ── Inventory Categories ──
    console.log('📦 Clearing old inventory categories...');
    await InventoryCategory.deleteMany({});
    await InventoryCategory.insertMany(inventoryCategories);
    console.log(`✅ ${inventoryCategories.length} Inventory Categories inserted!\n`);

    // ── Inventory Items ──
    console.log('🏭 Clearing old inventory items...');
    await Inventory.deleteMany({});

    // Compute status + sync fields manually (insertMany skips pre-save hooks)
    const preparedInventory = inventoryItems.map(item => {
      const stock = item.quantity;
      const reorder = item.reorderLevel;
      let status = 'IN_STOCK';
      if (stock <= 0) status = 'OUT_OF_STOCK';
      else if (stock <= reorder) status = 'LOW_STOCK';
      return {
        ...item,
        stock:    item.quantity,
        minStock: item.reorderLevel,
        cost:     item.costPrice,
        status,
      };
    });
    await Inventory.insertMany(preparedInventory);
    console.log(`✅ ${inventoryItems.length} Inventory Items inserted!\n`);

    console.log('🎉 ALL DATA PUSHED TO ATLAS CLOUD SUCCESSFULLY!');
    console.log('─────────────────────────────────────────────');
    console.log(`   Menu Categories : ${menuCategories.length}`);
    console.log(`   Menu Items       : ${menuItems.length}`);
    console.log(`   Inv Categories  : ${inventoryCategories.length}`);
    console.log(`   Inventory Items  : ${inventoryItems.length}`);
    console.log('─────────────────────────────────────────────\n');

  } catch (err) {
    console.error('❌ Error pushing to cloud:', err.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Connection closed.');
    process.exit(0);
  }
};

pushToCloud();
