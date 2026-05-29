const MenuItem = require('../models/MenuItem');

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
    const count = await MenuItem.countDocuments();
    if (count === 0) {
      console.log('Menu collection is empty. Seeding initial menu items...');
      await MenuItem.insertMany(defaultMenu);
      console.log('SUCCESS: Menu successfully seeded!');
    } else {
      console.log(`Database already contains ${count} menu items. Skipping seeding.`);
    }
  } catch (error) {
    console.error('ERROR seeding menu items:', error.message);
  }
};

module.exports = seedMenu;
