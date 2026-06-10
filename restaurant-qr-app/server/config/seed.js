const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const Cafe = require('../models/Cafe');
const Category = require('../models/Category');

const defaultMenu = [
  // Signature Chai
  {
    name: 'Regular Tea',
    image: '/images/default-food.png',
    price: 20,
    category: 'Signature Chai',
    available: true,
    description: 'Traditional regular chai brewed to perfection with fresh milk and tea leaves.',
    preparationTime: 5,
    recipe: [
      { name: 'Tea Leaves', quantity: 10 },
      { name: 'Milk', quantity: 100 },
      { name: 'Sugar', quantity: 8 }
    ]
  },
  {
    name: 'Black Tea',
    image: '/images/default-food.png',
    price: 15,
    category: 'Signature Chai',
    available: true,
    description: 'Strong, revitalizing black tea brewed without milk.',
    preparationTime: 4,
    recipe: [
      { name: 'Tea Leaves', quantity: 10 },
      { name: 'Sugar', quantity: 8 }
    ]
  },
  {
    name: 'Elaichi Tea',
    image: '/images/default-food.png',
    price: 25,
    category: 'Signature Chai',
    available: true,
    description: 'Fragrant cardamom-infused Indian milk chai.',
    preparationTime: 5,
    recipe: [
      { name: 'Tea Leaves', quantity: 10 },
      { name: 'Milk', quantity: 100 },
      { name: 'Sugar', quantity: 8 },
      { name: 'Cardamom', quantity: 2 }
    ]
  },
  {
    name: 'Ginger Tea',
    image: '/images/default-food.png',
    price: 25,
    category: 'Signature Chai',
    available: true,
    description: 'Warm and spicy ginger milk tea, great for throat relief.',
    preparationTime: 5,
    recipe: [
      { name: 'Tea Leaves', quantity: 10 },
      { name: 'Milk', quantity: 100 },
      { name: 'Sugar', quantity: 8 },
      { name: 'Ginger', quantity: 5 }
    ]
  },
  {
    name: 'Allam Bellam Tea',
    image: '/images/default-food.png',
    price: 30,
    category: 'Signature Chai',
    available: true,
    description: 'Traditional ginger and organic jaggery tea (Bellam). No refined sugar.',
    preparationTime: 6,
    recipe: [
      { name: 'Tea Leaves', quantity: 10 },
      { name: 'Milk', quantity: 100 },
      { name: 'Jaggery', quantity: 10 },
      { name: 'Ginger', quantity: 5 }
    ]
  },

  // Coffee Selection
  {
    name: 'Classic Coffee',
    image: '/images/default-food.png',
    price: 30,
    category: 'Coffee Selection',
    available: true,
    description: 'Traditional rich aromatic hot coffee.',
    preparationTime: 5,
    recipe: [
      { name: 'Coffee Powder', quantity: 15 },
      { name: 'Milk', quantity: 200 },
      { name: 'Sugar', quantity: 10 }
    ]
  },
  {
    name: 'Chocolate Coffee',
    image: '/images/default-food.png',
    price: 40,
    category: 'Coffee Selection',
    available: true,
    description: 'Rich coffee brewed with steamed milk and a swirl of chocolate syrup.',
    preparationTime: 6,
    recipe: [
      { name: 'Coffee Powder', quantity: 15 },
      { name: 'Milk', quantity: 200 },
      { name: 'Sugar', quantity: 10 },
      { name: 'Chocolate Syrup', quantity: 20 }
    ]
  },
  {
    name: 'Cold Coffee',
    image: '/images/default-food.png',
    price: 50,
    category: 'Coffee Selection',
    available: true,
    description: 'Creamy chilled coffee blended with ice cream and milk.',
    preparationTime: 7,
    recipe: [
      { name: 'Coffee Powder', quantity: 15 },
      { name: 'Milk', quantity: 250 },
      { name: 'Sugar', quantity: 15 },
      { name: 'Ice Cream', quantity: 50 }
    ]
  },

  // Fresh Juices & Coolers
  {
    name: 'Goli Soda',
    image: '/images/default-food.png',
    price: 25,
    category: 'Fresh Juices & Coolers',
    available: true,
    description: 'Classic Indian street-style lemon soda bottle cooler.',
    preparationTime: 3,
    recipe: [
      { name: 'Lemon Juice', quantity: 15 },
      { name: 'Soda Water', quantity: 250 },
      { name: 'Sugar Syrup', quantity: 20 }
    ]
  },
  {
    name: 'Badam Milk',
    image: '/images/default-food.png',
    price: 40,
    category: 'Fresh Juices & Coolers',
    available: true,
    description: 'Chilled rich almond flavored milk with cardamom.',
    preparationTime: 3,
    recipe: [
      { name: 'Milk', quantity: 200 },
      { name: 'Almond Powder', quantity: 15 },
      { name: 'Sugar', quantity: 10 }
    ]
  },
  {
    name: 'Watermelon Juice',
    image: '/images/default-food.png',
    price: 40,
    category: 'Fresh Juices & Coolers',
    available: true,
    description: 'Freshly blended sweet watermelon juice, fully refreshing.',
    preparationTime: 5,
    recipe: [
      { name: 'Watermelon Fruit', quantity: 200 },
      { name: 'Sugar Syrup', quantity: 10 }
    ]
  },
  {
    name: 'Musk Melon Juice',
    image: '/images/default-food.png',
    price: 45,
    category: 'Fresh Juices & Coolers',
    available: true,
    description: 'Thick, creamy musk melon juice freshly blended.',
    preparationTime: 5,
    recipe: [
      { name: 'Musk Melon Fruit', quantity: 200 },
      { name: 'Sugar Syrup', quantity: 15 }
    ]
  },
  {
    name: 'Lassi',
    image: '/images/default-food.png',
    price: 40,
    category: 'Fresh Juices & Coolers',
    available: true,
    description: 'Sweet Punjabi style thick churned yogurt lassi.',
    preparationTime: 4,
    recipe: [
      { name: 'Curd', quantity: 150 },
      { name: 'Sugar', quantity: 20 },
      { name: 'Milk', quantity: 50 }
    ]
  },
  {
    name: 'Mango Juice',
    image: '/images/default-food.png',
    price: 50,
    category: 'Fresh Juices & Coolers',
    available: true,
    description: 'Thick pulpy sweet mango juice.',
    preparationTime: 4,
    recipe: [
      { name: 'Mango Pulp', quantity: 100 },
      { name: 'Milk', quantity: 100 },
      { name: 'Sugar', quantity: 10 }
    ]
  },

  // Thick Milkshakes
  {
    name: 'Chocolate Milkshake',
    image: '/images/default-food.png',
    price: 60,
    category: 'Thick Milkshakes',
    available: true,
    description: 'Thick, indulgent double chocolate milkshake.',
    preparationTime: 6,
    recipe: [
      { name: 'Milk', quantity: 200 },
      { name: 'Chocolate Syrup', quantity: 30 },
      { name: 'Ice Cream', quantity: 50 }
    ]
  },
  {
    name: 'Vanilla Milkshake',
    image: '/images/default-food.png',
    price: 55,
    category: 'Thick Milkshakes',
    available: true,
    description: 'Creamy vanilla milkshake blended with premium vanilla ice cream.',
    preparationTime: 5,
    recipe: [
      { name: 'Milk', quantity: 200 },
      { name: 'Vanilla Essence', quantity: 5 },
      { name: 'Ice Cream', quantity: 50 }
    ]
  },
  {
    name: 'Strawberry Milkshake',
    image: '/images/default-food.png',
    price: 60,
    category: 'Thick Milkshakes',
    available: true,
    description: 'Creamy sweet strawberry milkshake.',
    preparationTime: 5,
    recipe: [
      { name: 'Milk', quantity: 200 },
      { name: 'Strawberry Syrup', quantity: 30 },
      { name: 'Ice Cream', quantity: 50 }
    ]
  },
  {
    name: 'Hazelnut Milkshake',
    image: '/images/default-food.png',
    price: 70,
    category: 'Thick Milkshakes',
    available: true,
    description: 'Decadent thick milkshake with roasted hazelnut notes.',
    preparationTime: 6,
    recipe: [
      { name: 'Milk', quantity: 200 },
      { name: 'Hazelnut Syrup', quantity: 25 },
      { name: 'Ice Cream', quantity: 50 }
    ]
  },

  // Starters & Bites
  {
    name: 'Osmaniya Biscuit',
    image: '/images/default-food.png',
    price: 10,
    category: 'Starters & Bites',
    available: true,
    description: 'Authentic sweet & salty Hyderabadi tea biscuit.',
    preparationTime: 2,
    recipe: [
      { name: 'Biscuit Pack', quantity: 1 }
    ]
  },
  {
    name: 'Veg Puff',
    image: '/images/default-food.png',
    price: 25,
    category: 'Starters & Bites',
    available: true,
    description: 'Crispy flaky puff stuffed with seasoned potatoes, carrots & peas.',
    preparationTime: 5,
    recipe: [
      { name: 'Veg Puff Raw', quantity: 1 }
    ]
  },
  {
    name: 'Egg Puff',
    image: '/images/default-food.png',
    price: 30,
    category: 'Starters & Bites',
    available: true,
    description: 'Crispy pastry folded around half a hardboiled egg and spiced masala.',
    preparationTime: 5,
    recipe: [
      { name: 'Egg Puff Raw', quantity: 1 }
    ]
  },
  {
    name: 'Chicken Puff',
    image: '/images/default-food.png',
    price: 35,
    category: 'Starters & Bites',
    available: true,
    description: 'Flaky baked pastry filled with tender spiced shredded chicken.',
    preparationTime: 5,
    recipe: [
      { name: 'Chicken Puff Raw', quantity: 1 }
    ]
  },
  {
    name: 'Muska Bun',
    image: '/images/default-food.png',
    price: 30,
    category: 'Starters & Bites',
    available: true,
    description: 'Fresh soft sweet bun sliced and packed with unsalted butter and fresh cream.',
    preparationTime: 3,
    recipe: [
      { name: 'Bun', quantity: 1 },
      { name: 'Butter', quantity: 20 }
    ]
  },
  {
    name: 'Samosa',
    image: '/images/default-food.png',
    price: 15,
    category: 'Starters & Bites',
    available: true,
    description: 'Crispy golden fried triangle potato-peas samosa.',
    preparationTime: 5,
    recipe: [
      { name: 'Samosa Raw', quantity: 1 }
    ]
  },
  {
    name: 'Veg Sandwich',
    image: '/images/default-food.png',
    price: 45,
    category: 'Starters & Bites',
    available: true,
    description: 'Grilled sandwich with cucumber, tomato, potato mash, and mint chutney.',
    preparationTime: 8,
    recipe: [
      { name: 'Bread Slices', quantity: 2 },
      { name: 'Butter', quantity: 10 },
      { name: 'Cucumber', quantity: 20 },
      { name: 'Tomato', quantity: 20 }
    ]
  },

  // French Fries
  {
    name: 'Small Fries',
    image: '/images/default-food.png',
    price: 40,
    category: 'French Fries',
    available: true,
    description: 'Crispy salted golden french fries (Small size).',
    preparationTime: 5,
    recipe: [
      { name: 'Potato Fries Raw', quantity: 100 },
      { name: 'Salt', quantity: 5 }
    ]
  },
  {
    name: 'Medium Fries',
    image: '/images/default-food.png',
    price: 60,
    category: 'French Fries',
    available: true,
    description: 'Crispy salted golden french fries (Medium size).',
    preparationTime: 5,
    recipe: [
      { name: 'Potato Fries Raw', quantity: 150 },
      { name: 'Salt', quantity: 8 }
    ]
  },
  {
    name: 'Large Fries',
    image: '/images/default-food.png',
    price: 80,
    category: 'French Fries',
    available: true,
    description: 'Crispy salted golden french fries (Large size).',
    preparationTime: 5,
    recipe: [
      { name: 'Potato Fries Raw', quantity: 200 },
      { name: 'Salt', quantity: 10 }
    ]
  }
];

const seedMenu = async () => {
  try {
    // 1. Clean existing categories & Menu Items to remove demo data
    console.log('Clearing old menu items and categories...');
    await MenuItem.deleteMany({});
    await Category.deleteMany({});

    // 2. Seed Cafe categories
    const categoriesToSeed = [
      { name: 'Signature Chai', cafeId: 'CD001' },
      { name: 'Coffee Selection', cafeId: 'CD001' },
      { name: 'Fresh Juices & Coolers', cafeId: 'CD001' },
      { name: 'Thick Milkshakes', cafeId: 'CD001' },
      { name: 'Starters & Bites', cafeId: 'CD001' },
      { name: 'French Fries', cafeId: 'CD001' }
    ];
    await Category.insertMany(categoriesToSeed);
    console.log('SUCCESS: Dynamic Menu Categories seeded!');

    // 3. Seed Menu Items
    await MenuItem.insertMany(defaultMenu);
    console.log(`SUCCESS: ${defaultMenu.length} actual Dr. Chai Cafe menu items seeded!`);

    // 4. Seed default Cafe Owner & Cafe record
    const email = 'kamalabevara@gmail.com';
    const existingUser = await User.findOne({ email });
    
    if (!existingUser) {
      console.log(`Default owner account not found for ${email}. Seeding owner and cafe...`);
      
      // Create Cafe
      const defaultCafe = new Cafe({
        cafeId: 'CD001',
        name: 'Dr. Chai Cafe',
        ownerName: 'Kamala Bevara',
        ownerEmail: email,
        ownerPhone: '9876543210',
        isActive: true
      });
      await defaultCafe.save();
      console.log('SUCCESS: Default Cafe CD001 seeded!');

      // Create Admin/Owner User
      const defaultOwner = new User({
        name: 'Kamala Bevara',
        email: email,
        phone: '9876543210',
        role: 'admin',
        cafeId: 'CD001',
        isActive: true
      });
      await defaultOwner.save();
      console.log(`SUCCESS: Owner account seeded for ${email}!`);
    } else {
      console.log(`Database already contains user record for ${email}. Skipping owner seeding.`);
    }
  } catch (error) {
    console.error('ERROR seeding database:', error.message);
  }
};

module.exports = seedMenu;
