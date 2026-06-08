const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const Cafe = require('../models/Cafe');

const defaultMenu = [
  {
    name: 'Gourmet Smash Burger',
    image: '/images/burger.png',
    price: 12.99,
    category: 'Burgers',
    available: true,
    description: 'Double smashed beef patties, melting cheddar, fresh butter lettuce, tomato, house secret sauce on toasted brioche.'
  },
  {
    name: 'Cheesy Pepperoni Pizza',
    image: '/images/pizza.png',
    price: 15.49,
    category: 'Pizzas',
    available: true,
    description: 'Wood-fired sourdough pizza crust, rich marinara, overflowing mozzarella, loaded with premium pepperoni slice & basil.'
  },
  {
    name: 'Creamy Fettuccine Carbonara',
    image: '/images/pasta.png',
    price: 13.99,
    category: 'Pasta',
    available: true,
    description: 'Al dente fettuccine in a velvety egg yolk & parmesan sauce, crispy pancetta lardons, cracked black pepper.'
  },
  {
    name: 'Artisanal Latte Cafe',
    image: '/images/coffee.png',
    price: 4.99,
    category: 'Drinks',
    available: true,
    description: 'Double espresso pulled from organic medium roast beans, silky smooth steamed milk, topped with unique latte art.'
  },
  {
    name: 'Grilled Chicken Club Sandwich',
    image: '/images/sandwich.png',
    price: 11.49,
    category: 'Sandwiches',
    available: true,
    description: 'Toasted sourdough stacked with seasoned grilled chicken breast, smoky bacon, avocado, heirloom tomato & garlic aioli.'
  }
];

const seedMenu = async () => {
  try {
    // 1. Seed Menu Items
    const count = await MenuItem.countDocuments();
    if (count === 0) {
      console.log('Menu collection is empty. Seeding initial menu items...');
      await MenuItem.insertMany(defaultMenu);
      console.log('SUCCESS: Menu successfully seeded!');
    } else {
      console.log(`Database already contains ${count} menu items. Skipping seeding.`);
    }

    // 2. Seed default Cafe Owner & Cafe record
    const email = 'kamalabevara@gmail.com';
    const existingUser = await User.findOne({ email });
    
    if (!existingUser) {
      console.log(`Default owner account not found for ${email}. Seeding owner and cafe...`);
      
      // Create Cafe
      const defaultCafe = new Cafe({
        cafeId: 'CD001',
        name: 'Coffee Day Cafe',
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
