const InventoryCategory = require('../models/InventoryCategory');
const Inventory = require('../models/Inventory');

const DEFAULT_INVENTORY_CATEGORIES = [
  'Tea Ingredients',
  'Coffee Ingredients',
  'Juice Ingredients',
  'Milkshake Ingredients',
  'Bakery Items',
  'Snacks',
  'Packaging Materials',
  'Cleaning Supplies'
];

const seedDefaultInventoryCategories = async (cafeId) => {
  const categoriesToCreate = DEFAULT_INVENTORY_CATEGORIES.map(name => ({
    name,
    cafeId
  }));
  return await InventoryCategory.insertMany(categoriesToCreate);
};

// @desc    Get all inventory categories
// @route   GET /api/inventory/categories
// @access  Protected
const getInventoryCategories = async (req, res) => {
  try {
    const cafeId = req.query.cafeId || (req.user && req.user.cafeId) || 'CD001';
    let categories = await InventoryCategory.find({ cafeId }).sort({ name: 1 });

    if (categories.length === 0) {
      categories = await seedDefaultInventoryCategories(cafeId);
    }

    return res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    console.error('Error fetching inventory categories:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching inventory categories', error: error.message });
  }
};

// @desc    Create a new inventory category
// @route   POST /api/inventory/categories
// @access  Protected (Owner/Admin)
const createInventoryCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const cafeId = req.user.cafeId || 'CD001';

    if (!name) {
      return res.status(400).json({ success: false, message: 'Please provide a category name' });
    }

    const exists = await InventoryCategory.findOne({ name: name.trim(), cafeId });
    if (exists) {
      return res.status(400).json({ success: false, message: 'Category already exists' });
    }

    const newCategory = new InventoryCategory({
      name: name.trim(),
      cafeId
    });

    const savedCategory = await newCategory.save();
    return res.status(201).json({ success: true, data: savedCategory });
  } catch (error) {
    console.error('Error creating inventory category:', error);
    return res.status(500).json({ success: false, message: 'Server error while creating inventory category', error: error.message });
  }
};

// @desc    Delete an inventory category
// @route   DELETE /api/inventory/categories/:id
// @access  Protected (Owner/Admin)
const deleteInventoryCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const cafeId = req.user.cafeId || 'CD001';

    const category = await InventoryCategory.findOne({ _id: id, cafeId });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const categoryName = category.name;

    await InventoryCategory.deleteOne({ _id: id, cafeId });

    // Update items under this category to 'Uncategorized'
    await Inventory.updateMany(
      { category: categoryName, cafeId },
      { category: 'Uncategorized' }
    );

    return res.status(200).json({ success: true, message: 'Inventory category deleted successfully, items moved to Uncategorized' });
  } catch (error) {
    console.error('Error deleting inventory category:', error);
    return res.status(500).json({ success: false, message: 'Server error while deleting inventory category', error: error.message });
  }
};

module.exports = {
  getInventoryCategories,
  createInventoryCategory,
  deleteInventoryCategory
};
